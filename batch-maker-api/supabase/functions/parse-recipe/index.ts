// @ts-nocheck


/**
 * Supabase Edge Function: parse-recipe
 * FIXED: Always creates Step 0 "Prepare Ingredients" + numbered cooking steps
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

const LIMIT_PER_HOUR = 5;
const LIMIT_PER_DAY = 15;

const SYSTEM_PROMPT = `You are a professional recipe parser for a bakery app.

Parse the recipe and return ONLY valid JSON (no markdown, no code blocks).

CRITICAL RULES:
1. Do NOT create a "Prepare Ingredients" step - the app will add that automatically
2. Return ONLY the actual cooking steps (mixing, baking, resting, etc.)
3. Each step must have an "ingredients" array with ONLY ingredients used in THAT step
4. Format: ["ingredient name: amount unit"] e.g. ["flour: 500g", "water: 350ml"]
5. If a step uses no ingredients (like resting), use empty array []
6. Extract duration_minutes ONLY for waiting steps (resting, baking, chilling)

JSON STRUCTURE:
{
  "recipeName": "Name of dish",
  "description": "Brief 1-2 sentence description",
  "ingredients": [
    { "name": "flour", "amount": "500", "unit": "g" },
    { "name": "water", "amount": "350", "unit": "ml" }
  ],
  "steps": [
    {
      "order": 1,
      "title": "Mix Dough",
      "description": "Combine flour and water in a large bowl. Mix until shaggy.",
      "duration_minutes": 5,
      "ingredients": ["flour: 500g", "water: 350ml"]
    },
    {
      "order": 2,
      "title": "Rest Dough",
      "description": "Cover bowl and let rest at room temperature.",
      "duration_minutes": 30,
      "ingredients": []
    },
    {
      "order": 3,
      "title": "Add Salt",
      "description": "Sprinkle salt over dough and fold in.",
      "duration_minutes": 3,
      "ingredients": ["salt: 10g"]
    }
  ]
}

PARSING RULES:
- Amounts as strings: "500", "2.5", "1/2", "to taste"
- Empty unit "" for countable items (3 eggs)
- Match ingredients to steps by when they're used
- Don't duplicate step 0 / prep step - app handles that

If not a recipe, return: {"error": "not_a_recipe", "message": "Not a recipe"}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function checkRateLimit(supabase: any, userId: string): Promise<string | null> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const { count: hourCount } = await supabase
      .from('recipe_parse_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString());

    if (hourCount && hourCount >= LIMIT_PER_HOUR) {
      return `You've parsed ${LIMIT_PER_HOUR} recipes in the last hour. Please wait.`;
    }

    const { count: dayCount } = await supabase
      .from('recipe_parse_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo.toISOString());

    if (dayCount && dayCount >= LIMIT_PER_DAY) {
      return `Daily limit of ${LIMIT_PER_DAY} reached. Try tomorrow.`;
    }

    return null;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return null;
  }
}

async function recordParse(supabase: any, userId: string, success: boolean): Promise<void> {
  try {
    await supabase.from('recipe_parse_logs').insert({
      user_id: userId,
      success: success,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to record parse:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'CONFIG_ERROR', message: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recipeText } = await req.json();

    if (!recipeText || recipeText.trim().length === 0) {
      await recordParse(supabase, user.id, false);
      return new Response(
        JSON.stringify({ error: 'PARSE_FAILURE', message: 'No recipe text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rateLimitError = await checkRateLimit(supabase, user.id);
    if (rateLimitError) {
      await recordParse(supabase, user.id, false);
      return new Response(
        JSON.stringify({ error: 'RATE_LIMITED', message: rateLimitError }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🤖 Calling Claude API...');

    const claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Parse this recipe:\n\n${recipeText}` }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text();
      console.error('❌ Claude error:', errorBody);
      await recordParse(supabase, user.id, false);
      return new Response(
        JSON.stringify({ error: 'API_FAILURE', message: `AI error: ${claudeResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData?.content?.[0]?.text;

    if (!responseText) {
      await recordParse(supabase, user.id, false);
      return new Response(
        JSON.stringify({ error: 'API_FAILURE', message: 'Empty AI response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Claude response received');

    let parsedRecipe;
    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      parsedRecipe = JSON.parse(cleaned);

      if (parsedRecipe.error === 'not_a_recipe') {
        await recordParse(supabase, user.id, false);
        return new Response(
          JSON.stringify({ error: 'NOT_A_RECIPE', message: parsedRecipe.message || 'Not a recipe' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError: any) {
      console.error('❌ JSON parse error:', parseError);
      await recordParse(supabase, user.id, false);
      return new Response(
        JSON.stringify({ error: 'PARSE_FAILURE', message: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ BUILD WORKFLOW WITH STEP 0
    const allIngredients = (parsedRecipe.ingredients || []).map((ing: any) => 
      `${ing.name}: ${ing.amount}${ing.unit}`
    );

    const steps = [
      // Step 0: Prepare Ingredients (ALL ingredients)
      {
        order: 0,
        title: 'Prepare Ingredients',
        description: 'Gather and measure all ingredients before starting.',
        duration_minutes: 0,
        temperature: null,
        temperature_unit: null,
        notes: null,
        ingredients: allIngredients
      },
      // Steps 1+: Actual cooking steps with their specific ingredients
      ...(parsedRecipe.steps || []).map((step: any, index: number) => ({
        order: index + 1,
        title: step.title || `Step ${index + 1}`,
        description: step.description || '',
        duration_minutes: step.duration_minutes || 0,
        temperature: step.temperature || null,
        temperature_unit: step.temperature_unit || null,
        notes: step.notes || null,
        ingredients: step.ingredients || []
      }))
    ];

    const workflow = {
      name: parsedRecipe.recipeName || 'New Recipe',
      description: parsedRecipe.description || '',
      servings: parsedRecipe.servings || null,
      total_time_minutes: parsedRecipe.totalEstimatedMinutes || 0,
      ingredients: parsedRecipe.ingredients || [],
      steps: steps
    };

    console.log('✅ Workflow created with', steps.length, 'steps (including prep)');

    await recordParse(supabase, user.id, true);

    return new Response(
      JSON.stringify({ success: true, workflow: workflow }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Error:', error);
    return new Response(
      JSON.stringify({ error: 'UNKNOWN', message: error?.message || 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});