// @ts-nocheck

/**
 * Supabase Edge Function: parse-recipe
 * 
 * This function runs on Supabase's servers (not in your app).
 * It keeps your Anthropic API key secret and handles all Claude calls.
 * 
 * Deploy this to: supabase/functions/parse-recipe/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 3000;

// Rate limits
const LIMIT_PER_HOUR = 5;
const LIMIT_PER_DAY = 15;

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional recipe parser for a bakery management app called Batch Maker.

Your ONLY job is to take a raw recipe and convert it into a clean, structured JSON workflow.

CRITICAL REQUIREMENTS:
1. First step MUST ALWAYS be "Prepare Ingredients" with ALL ingredients as a checklist
2. Each cooking step should ONLY include the specific ingredients needed for THAT step
3. Extract timer durations per step (in minutes) - ONLY for steps that require waiting
4. DO NOT include prep time, cook time, total time, servings, calories, or any recipe metadata
5. Focus ONLY on: step-by-step instructions, ingredients per step, and timers per step

JSON STRUCTURE (return ONLY this, no markdown, no code blocks):
{
  "recipeName": "Name of the dish",
  "description": "Brief 1-2 sentence description",
  "ingredients": [
    { "name": "all-purpose flour", "amount": "500", "unit": "g" },
    { "name": "water", "amount": "350", "unit": "ml" },
    { "name": "salt", "amount": "10", "unit": "g" }
  ],
  "steps": [
    {
      "order": 1,
      "title": "Prepare Ingredients",
      "description": "Gather and measure all ingredients listed below.",
      "duration_minutes": 0,
      "ingredients_for_step": ["all-purpose flour: 500g", "water: 350ml", "salt: 10g", "yeast: 5g"]
    },
    {
      "order": 2,
      "title": "Mix Dough",
      "description": "In a large bowl, combine the flour and water. Mix with a wooden spoon until shaggy. No kneading needed yet.",
      "duration_minutes": 5,
      "ingredients_for_step": ["all-purpose flour: 500g", "water: 350ml"]
    },
    {
      "order": 3,
      "title": "Autolyse Rest",
      "description": "Cover the bowl with a damp towel and let the dough rest at room temperature. This allows the flour to fully hydrate.",
      "duration_minutes": 30,
      "ingredients_for_step": []
    },
    {
      "order": 4,
      "title": "Add Salt",
      "description": "Sprinkle the salt over the dough and mix it in thoroughly with your hands. The dough will become smoother.",
      "duration_minutes": 3,
      "ingredients_for_step": ["salt: 10g"]
    }
  ]
}

PARSING RULES:
1. INGREDIENTS:
   - Amount as STRING: "2.5", "1/2", "0.5", "to taste"
   - Use empty string "" for unit when counting (3 eggs, 2 onions)
   - Standard units: cups, tbsp, tsp, oz, lb, g, kg, ml, l

2. STEPS:
   - Step 1 is ALWAYS "Prepare Ingredients"
   - Title: Short and action-oriented (3-6 words)
   - Description: Detailed, clear instructions
   - duration_minutes: Only include if step involves waiting (resting, baking, chilling, etc.)
   - ingredients_for_step: Array of strings like ["flour: 500g", "water: 350ml"]

3. INGREDIENT MATCHING:
   - Match ingredients to steps based on when they're actually used
   - If unsure, put ingredient in the earliest step where it might be used
   - Empty array [] if no ingredients used in that step (like resting/waiting steps)

4. NOT A RECIPE:
   - If text is clearly not a recipe, return:
     {"error": "not_a_recipe", "message": "This does not appear to be a recipe"}

EXAMPLE INPUT:
"Sourdough Bread
500g flour
350ml water  
10g salt
Mix flour and water, rest 30 min, add salt, rest 4 hours"

EXAMPLE OUTPUT:
{
  "recipeName": "Sourdough Bread",
  "description": "A simple sourdough bread recipe with autolyse.",
  "ingredients": [
    {"name": "flour", "amount": "500", "unit": "g"},
    {"name": "water", "amount": "350", "unit": "ml"},
    {"name": "salt", "amount": "10", "unit": "g"}
  ],
  "steps": [
    {
      "order": 1,
      "title": "Prepare Ingredients",
      "description": "Gather and measure all ingredients.",
      "duration_minutes": 0,
      "ingredients_for_step": ["flour: 500g", "water: 350ml", "salt: 10g"]
    },
    {
      "order": 2,
      "title": "Mix Flour and Water",
      "description": "Combine flour and water in a bowl and mix until combined.",
      "duration_minutes": 5,
      "ingredients_for_step": ["flour: 500g", "water: 350ml"]
    },
    {
      "order": 3,
      "title": "Autolyse Rest",
      "description": "Cover and let rest at room temperature.",
      "duration_minutes": 30,
      "ingredients_for_step": []
    },
    {
      "order": 4,
      "title": "Add Salt",
      "description": "Mix in the salt thoroughly.",
      "duration_minutes": 3,
      "ingredients_for_step": ["salt: 10g"]
    },
    {
      "order": 5,
      "title": "Bulk Fermentation",
      "description": "Cover and let rest at room temperature.",
      "duration_minutes": 240,
      "ingredients_for_step": []
    }
  ]
}

Return ONLY valid JSON. No explanation. No markdown.`;

// ─── CORS HEADERS ────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

async function checkRateLimit(supabase: any, userId: string): Promise<string | null> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { count: hourCount, error: hourError } = await supabase
    .from('recipe_parse_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo.toISOString());

  if (hourError) {
    console.error('Error checking hourly rate limit:', hourError);
  }

  if (hourCount && hourCount >= LIMIT_PER_HOUR) {
    return `You've parsed ${LIMIT_PER_HOUR} recipes in the last hour. Please wait a bit before trying again.`;
  }

  const { count: dayCount, error: dayError } = await supabase
    .from('recipe_parse_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo.toISOString());

  if (dayError) {
    console.error('Error checking daily rate limit:', dayError);
  }

  if (dayCount && dayCount >= LIMIT_PER_DAY) {
    return `You've reached the daily limit of ${LIMIT_PER_DAY} recipe parses. Try again tomorrow.`;
  }

  return null;
}

async function recordParse(supabase: any, userId: string, success: boolean): Promise<void> {
  await supabase.from('recipe_parse_logs').insert({
    user_id: userId,
    success: success,
    created_at: new Date().toISOString(),
  });
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in Supabase');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Missing authorization header',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Authenticated user:', user.email);

    const { recipeText } = await req.json();

    if (!recipeText || recipeText.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'PARSE_FAILURE',
          message: 'No recipe text provided.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const rateLimitError = await checkRateLimit(supabase, user.id);
    if (rateLimitError) {
      return new Response(
        JSON.stringify({
          error: 'RATE_LIMITED',
          message: rateLimitError,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Parse this recipe:\n\n${recipeText}`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text();
      console.error('Claude API error:', errorBody);
      
      await recordParse(supabase, user.id, false);

      return new Response(
        JSON.stringify({
          error: 'API_FAILURE',
          message: `AI service returned error: ${claudeResponse.status}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData?.content?.[0]?.text;

    if (!responseText) {
      await recordParse(supabase, user.id, false);
      return new Response(
        JSON.stringify({
          error: 'API_FAILURE',
          message: 'Empty response from AI service',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await recordParse(supabase, user.id, true);

    // Parse the JSON and transform to expected format
    let parsedRecipe;
    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      parsedRecipe = JSON.parse(cleaned);

      if (parsedRecipe.error === 'not_a_recipe') {
        return new Response(
          JSON.stringify({
            error: 'NOT_A_RECIPE',
            message: parsedRecipe.message || 'This does not appear to be a recipe'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      await recordParse(supabase, user.id, false);
      return new Response(
        JSON.stringify({
          error: 'PARSE_FAILURE',
          message: 'Failed to parse AI response',
          details: responseText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return in workflow format
    return new Response(
      JSON.stringify({
        success: true,
        workflow: {
          name: parsedRecipe.recipeName,
          description: parsedRecipe.description || '',
          ingredients: parsedRecipe.ingredients || [],
          steps: parsedRecipe.steps || [],
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: 'UNKNOWN',
        message: error?.message || 'Something went wrong',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});