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
const MAX_TOKENS = 2000;

// Rate limits
const LIMIT_PER_HOUR = 5;
const LIMIT_PER_DAY = 15;

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional recipe parser for a bakery management app called Batch Maker.

Your ONLY job is to take a raw recipe (in any format — typed out, copied from a website, messy notes, anything) and convert it into a clean, structured JSON object.

RULES:
1. Return ONLY valid JSON. No markdown. No code blocks. No explanation. Just the raw JSON object.
2. Every ingredient MUST have a name, amount (number), and unit (string).
3. If an amount is given as a fraction like "1/2", convert it to a decimal: 0.5.
4. If no amount is given for an ingredient, use 0 and set unit to "unknown".
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
    { "name": "string", "amount": number, "unit": "string", "estimated_cost": 0 }
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
 * Check rate limits using Supabase database instead of AsyncStorage.
 * This is more secure and works across all user devices.
 */
async function checkRateLimit(supabase: any, userId: string): Promise<string | null> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Count parses in the last hour
  const { count: hourCount, error: hourError } = await supabase
    .from('recipe_parse_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo.toISOString());

  if (hourError) {
    console.error('Error checking hourly rate limit:', hourError);
    // Don't block the user if we can't check - fail open
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
  }

  if (dayCount && dayCount >= LIMIT_PER_DAY) {
    return `You've reached the daily limit of ${LIMIT_PER_DAY} recipe parses. Try again tomorrow.`;
  }

  return null; // All good
}

/**
 * Record a parse attempt in the database
 */
async function recordParse(supabase: any, userId: string, success: boolean): Promise<void> {
  await supabase.from('recipe_parse_logs').insert({
    user_id: userId,
    success: success,
    created_at: new Date().toISOString(),
  });
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Get the API key from environment (set in Supabase dashboard)
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in Supabase');
    }

    // ── Get the Supabase client (for rate limiting)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Parse request body
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

    // ── Get authenticated user
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
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

    // ── Check rate limit
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

    // ── Call Claude API
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
      
      // Record failed attempt
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

    // ── Record successful parse
    await recordParse(supabase, user.id, true);

    // ── Return the raw Claude response (client will parse it)
    return new Response(
      JSON.stringify({
        success: true,
        responseText: responseText,
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