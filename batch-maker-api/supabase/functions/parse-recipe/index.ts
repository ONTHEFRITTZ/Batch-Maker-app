/**
 * Supabase Edge Function: parse-recipe
 * 
 * Production version with:
 * - JWT authentication
 * - Rate limiting (5/hour, 15/day)
 * - Parse logging for analytics
 * - Proper error handling
 * - Returns workflow-ready structure
 * 
 * Deploy to: supabase/functions/parse-recipe/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

// Rate limits
const LIMIT_PER_HOUR = 5;
const LIMIT_PER_DAY = 15;

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional recipe parser for a bakery management app called Batch Maker.

Your ONLY job is to take a raw recipe (in any format — typed out, copied from a website, messy notes, anything) and convert it into a clean, structured JSON object.

RULES:
1. Return ONLY valid JSON. No markdown. No code blocks. No explanation. Just the raw JSON object.
2. Every ingredient MUST have a name, amount (as STRING to support fractions), and unit.
3. Keep fractions as strings: "1/2", "1/4", "2 1/2" etc.
4. If no amount is given for an ingredient, use "0" and set unit to "unknown".
5. Steps must be in the correct order (order field is 1-based).
6. If a step mentions a temperature, extract it into the temperature and temperature_unit fields.
7. If a step mentions a time/duration, extract it into duration_minutes. Convert hours to minutes.
8. If no duration is mentioned for a step, set duration_minutes to 0.
9. totalEstimatedMinutes should be the sum of all step durations, plus any reasonable prep/resting time you can infer.
10. estimated_cost for each ingredient should be 0 — we don't know prices.
11. Infer servings if mentioned anywhere in the recipe (e.g. "Makes 12 muffins"). Otherwise omit it.
12. If the recipe text is completely unintelligible or not a recipe at all, return:
    {"error": "not_a_recipe", "message": "The text does not appear to be a recipe."}

JSON STRUCTURE (return exactly this shape):
{
  "recipeName": "string",
  "description": "string (1-2 sentence summary)",
  "ingredients": [
    { "name": "string", "amount": "string", "unit": "string", "estimated_cost": 0 }
  ],
  "steps": [
    {
      "order": number,
      "title": "string (short, 2-5 words)",
      "description": "string (full instructions for this step)",
      "duration_minutes": number,
      "temperature": number or null,
      "temperature_unit": "C" or "F" or null,
      "notes": "string or null (tips, warnings, optional extras)"
    }
  ],
  "totalEstimatedMinutes": number,
  "servings": "string or null"
}`;

// ─── CORS HEADERS ────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

/**
 * Check rate limits using Supabase database.
 * More secure than client-side storage and works across devices.
 */
async function checkRateLimit(supabase: any, userId: string): Promise<string | null> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Count parses in the last hour
    const { count: hourCount, error: hourError } = await supabase
      .from('recipe_parse_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString());

    if (hourError) {
      console.error('Error checking hourly rate limit:', hourError);
      // Fail open - don't block user if we can't check
      return null;
    }

    if (hourCount && hourCount >= LIMIT_PER_HOUR) {
      return `You've parsed ${LIMIT_PER_HOUR} recipes in the last hour. Please wait a bit before trying again.`;
    }

    // Count parses in the last day
    const { count: dayCount, error: dayError } = await supabase
      .from('recipe_parse_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo.toISOString());

    if (dayError) {
      console.error('Error checking daily rate limit:', dayError);
      return null;
    }

    if (dayCount && dayCount >= LIMIT_PER_DAY) {
      return `You've reached the daily limit of ${LIMIT_PER_DAY} recipe parses. Try again tomorrow.`;
    }

    return null; // All good
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return null; // Fail open
  }
}

/**
 * Record a parse attempt in the database for analytics and rate limiting
 */
async function recordParse(supabase: any, userId: string, success: boolean, errorCode?: string): Promise<void> {
  try {
    await supabase.from('recipe_parse_logs').insert({
      user_id: userId,
      success: success,
      error_code: errorCode || null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to record parse:', error);
    // Don't throw - logging failure shouldn't break the function
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔍 Parse Recipe Text - Production');

    // ── Get environment variables
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!anthropicApiKey) {
      console.error('❌ Missing ANTHROPIC_API_KEY');
      return new Response(
        JSON.stringify({
          error: 'CONFIG_ERROR',
          message: 'Server configuration error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ── Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ✅ IMPORTANT: Use ANON KEY with Authorization header (not Service Role Key)
    // This allows RLS policies to work correctly
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Auth error:', authError);
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

    console.log('✅ User authenticated:', user.id);

    // ── Parse request body
    const { recipeText } = await req.json();

    if (!recipeText || recipeText.trim().length === 0) {
      await recordParse(supabase, user.id, false, 'MISSING_TEXT');
      return new Response(
        JSON.stringify({
          error: 'MISSING_TEXT',
          message: 'No recipe text provided.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('📝 Recipe text length:', recipeText.length, 'characters');

    // ── Check rate limit
    const rateLimitError = await checkRateLimit(supabase, user.id);
    if (rateLimitError) {
      await recordParse(supabase, user.id, false, 'RATE_LIMITED');
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

    // ── Call Claude API
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
      console.error('❌ Claude API error:', errorBody);
      
      await recordParse(supabase, user.id, false, 'API_FAILURE');

      return new Response(
        JSON.stringify({
          error: 'API_FAILURE',
          message: `AI service returned error: ${claudeResponse.status}`,
          details: errorBody.substring(0, 200),
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
      console.error('❌ Empty response from Claude');
      await recordParse(supabase, user.id, false, 'EMPTY_RESPONSE');
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

    console.log('✅ Claude response received, length:', responseText.length);

    // ── Parse and transform the response
    let parsedRecipe;
    try {
      // Clean up response - remove markdown code blocks if present
      const cleanJson = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      parsedRecipe = JSON.parse(cleanJson);

      // Check if Claude identified it as not a recipe
      if (parsedRecipe.error === 'not_a_recipe') {
        await recordParse(supabase, user.id, false, 'NOT_A_RECIPE');
        return new Response(
          JSON.stringify({
            error: 'NOT_A_RECIPE',
            message: parsedRecipe.message || 'This does not appear to be a recipe',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (parseError: any) {
      console.error('❌ JSON parse error:', parseError.message);
      await recordParse(supabase, user.id, false, 'PARSE_ERROR');
      return new Response(
        JSON.stringify({
          error: 'PARSE_ERROR',
          message: 'Failed to parse AI response',
          rawResponse: responseText.substring(0, 500),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ── Transform to workflow format
    const workflow = {
      name: parsedRecipe.recipeName || 'New Recipe',
      description: parsedRecipe.description || '',
      servings: parsedRecipe.servings || null,
      total_time_minutes: parsedRecipe.totalEstimatedMinutes || 0,
      ingredients: (parsedRecipe.ingredients || []).map((ing: any) => ({
        name: ing.name || 'Unknown',
        amount: String(ing.amount || '0'),
        unit: ing.unit || '',
        estimated_cost: 0,
      })),
      steps: (parsedRecipe.steps || []).map((step: any) => ({
        order: step.order || 0,
        title: step.title || 'Step',
        description: step.description || '',
        duration_minutes: step.duration_minutes || 0,
        temperature: step.temperature || null,
        temperature_unit: step.temperature_unit || null,
        notes: step.notes || null,
      })),
    };

    console.log('✅ Workflow created:', workflow.name);

    // ── Record successful parse
    await recordParse(supabase, user.id, true);

    // ── Return workflow structure
    return new Response(
      JSON.stringify({
        success: true,
        workflow: workflow,
        user_id: user.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('💥 Edge function error:', error);
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