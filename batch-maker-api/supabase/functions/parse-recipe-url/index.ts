// @ts-nocheck

// parse-recipe-url edge function
// Fetches recipe from URL and parses it

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a professional recipe parser for a bakery management app.

CRITICAL REQUIREMENTS:
1. First step MUST ALWAYS be "Prepare Ingredients" with ALL ingredients
2. Each cooking step should ONLY list ingredients used in THAT step
3. Extract timer durations (in minutes) ONLY for waiting steps
4. DO NOT include metadata (prep time, cook time, servings, calories)
5. Return ONLY valid JSON, no markdown, no code blocks

JSON STRUCTURE:
{
  "recipeName": "Name of dish",
  "description": "Brief 1-2 sentence description",
  "ingredients": [
    {"name": "flour", "amount": "500", "unit": "g"}
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
      "title": "Mix Dough",
      "description": "Combine flour and water...",
      "duration_minutes": 5,
      "ingredients_for_step": ["flour: 500g", "water: 350ml"]
    },
    {
      "order": 3,
      "title": "Rest Dough",
      "description": "Cover and let rest...",
      "duration_minutes": 30,
      "ingredients_for_step": []
    }
  ]
}

RULES:
- Step 1 is ALWAYS ingredient prep
- ingredients_for_step: array of strings like ["item: amount"]
- duration_minutes: only for waiting (resting, baking, chilling)
- Return ONLY JSON`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('parse-recipe-url called');
    
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!anthropicApiKey) {
      console.error('Missing API key');
      return new Response(
        JSON.stringify({ error: 'CONFIG_ERROR', message: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'MISSING_URL', message: 'URL required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching:', url);

    const fetchResponse = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
    });
    
    if (!fetchResponse.ok) {
      throw new Error(`HTTP ${fetchResponse.status}`);
    }
    
    const htmlContent = await fetchResponse.text();
    console.log('Fetched HTML:', htmlContent.length, 'chars');

    const textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000);

    console.log('Extracted text:', textContent.length, 'chars');

    const prompt = `${SYSTEM_PROMPT}

WEBPAGE CONTENT:
${textContent}

Parse this recipe and return ONLY the JSON object.`;

    console.log('Calling Claude...');
    
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
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    console.log('Claude response status:', claudeResponse.status);

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'API_FAILURE', 
          message: 'AI error',
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text;
    
    console.log('Success! Response length:', responseText.length);

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
      return new Response(
        JSON.stringify({
          error: 'PARSE_FAILURE',
          message: 'Failed to parse AI response',
          details: parseError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});