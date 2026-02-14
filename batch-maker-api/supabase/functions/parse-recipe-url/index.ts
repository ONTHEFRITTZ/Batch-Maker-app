import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are a professional recipe parser. Extract recipe information and return ONLY valid JSON with no markdown, no code blocks, no extra text.

If not a recipe, return: {"error":"NOT_A_RECIPE"}

Otherwise return:
{
  "name": "Recipe Name",
  "prepare_ingredients_description": "Gather and measure all ingredients.",
  "ingredients": ["flour: 500g", "water: 350ml"],
  "steps": [
    {
      "order": 1,
      "title": "Mix",
      "description": "Mix ingredients",
      "duration_minutes": 5,
      "ingredients_for_step": ["flour: 500g"]
    }
  ]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log('🔍 parse-recipe-url called');

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'CONFIG_ERROR', message: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'BAD_REQUEST', message: 'URL required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔗 Fetching:', url);

    const fetchResponse = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
    });
    
    if (!fetchResponse.ok) {
      throw new Error(`HTTP ${fetchResponse.status}`);
    }
    
    const html = await fetchResponse.text();
    console.log('✅ Fetched HTML:', html.length, 'chars');

    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 12000);

    console.log('🤖 Calling Claude...');
    
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: cleaned }]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('❌ Claude error:', errorText);
      return new Response(
        JSON.stringify({ error: 'API_FAILURE', message: 'AI error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text;
    
    console.log('✅ Claude response length:', responseText.length);

    let parsed;
    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      parsed = JSON.parse(cleaned);

      if (parsed.error === 'NOT_A_RECIPE') {
        return new Response(
          JSON.stringify({ error: 'NOT_A_RECIPE', message: 'Not a recipe' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError: any) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'PARSE_FAILURE', message: 'Failed to parse' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];

    const prepStep = {
      order: 0,
      title: 'Prepare Ingredients',
      description: parsed.prepare_ingredients_description ?? 'Gather and measure all ingredients.',
      duration_minutes: null,
      ingredients_for_step: ingredients,
    };

    const steps = parsed.steps.map((s: any, i: number) => ({
      order: i + 1,
      title: s.title,
      description: s.description,
      duration_minutes: s.duration_minutes ?? null,
      ingredients_for_step: Array.isArray(s.ingredients_for_step) ? s.ingredients_for_step : [],
    }));

    return new Response(
      JSON.stringify({
        success: true,
        workflow: {
          name: parsed.name,
          ingredients,
          steps: [prepStep, ...steps],
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Error:', error.message);
    return new Response(
      JSON.stringify({ error: 'UNKNOWN', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});