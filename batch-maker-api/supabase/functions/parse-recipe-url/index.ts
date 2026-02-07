// FINAL PRODUCTION VERSION - parse-recipe-url
// File: supabase/functions/parse-recipe-url/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔍 parse-recipe-url called');
    
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!anthropicApiKey) {
      console.error('❌ Missing API key');
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

    console.log('🔗 Fetching:', url);

    // Fetch recipe page
    const fetchResponse = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
    });
    
    if (!fetchResponse.ok) {
      throw new Error(`HTTP ${fetchResponse.status}`);
    }
    
    const htmlContent = await fetchResponse.text();
    console.log('✅ Fetched HTML:', htmlContent.length, 'chars');

    // Extract text
    const textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000);

    console.log('✅ Extracted text:', textContent.length, 'chars');

    const prompt = `You are a professional recipe parser. Extract recipe information from the webpage content below and return it as valid JSON.

CRITICAL: Return ONLY the JSON object with no markdown formatting, no code fences, no extra text.

REQUIRED JSON STRUCTURE:
{
  "recipeName": "Name of the recipe",
  "description": "Brief 1-2 sentence description of the dish",
  "servings": "4 servings",
  "totalEstimatedMinutes": 45,
  "ingredients": [
    {
      "name": "all-purpose flour",
      "amount": "2.5",
      "unit": "cups"
    }
  ],
  "steps": [
    {
      "order": 1,
      "title": "Preheat oven",
      "description": "Preheat the oven to 350°F and line a baking sheet with parchment paper",
      "duration_minutes": 5,
      "temperature": 350,
      "temperature_unit": "F",
      "notes": "Make sure oven is fully heated before baking"
    }
  ]
}

PARSING RULES:
1. INGREDIENTS:
   - Keep amounts as strings: "2.5", "1/2", "2-3"
   - Use empty string "" for unit when counting items (3 eggs, 2 onions)
   - For "to taste": amount = "to taste", add notes
   - Normalize units: cups, tbsp, tsp, oz, lb, g, kg, ml, l

2. STEPS:
   - Keep titles short: 3-5 words max
   - Descriptions should be detailed and actionable
   - Estimate duration_minutes if not stated
   - Include temperature and temperature_unit when mentioned
   - Add notes for tips, warnings, alternatives

3. NOT A RECIPE:
   - If the text is clearly not a recipe, return:
     {"error": "not_a_recipe", "message": "This does not appear to be a recipe"}

WEBPAGE CONTENT:
${textContent}

Return ONLY the JSON object.`;

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
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    console.log('Claude response status:', claudeResponse.status);

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('❌ Claude error:', errorText);
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
    
    console.log('✅ Success! Response length:', responseText.length);

    // Parse the JSON response
    let parsedRecipe;
    try {
      // Remove markdown code fences if present
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      parsedRecipe = JSON.parse(cleaned);

      // Check if it's not a recipe
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
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({
          error: 'PARSE_FAILURE',
          message: 'Failed to parse AI response',
          details: parseError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return in the format your frontend expects
    return new Response(
      JSON.stringify({ 
        success: true,
        workflow: {
          name: parsedRecipe.recipeName,
          description: parsedRecipe.description || '',
          servings: parsedRecipe.servings || null,
          total_time_minutes: parsedRecipe.totalEstimatedMinutes || 0,
          ingredients: parsedRecipe.ingredients || [],
          steps: parsedRecipe.steps || [],
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});