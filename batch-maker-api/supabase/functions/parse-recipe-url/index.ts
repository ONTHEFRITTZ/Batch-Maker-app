import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a professional recipe parser. Parse the recipe from the provided HTML and return ONLY valid JSON with no markdown, no code blocks, no extra text.

Rules:
- Do NOT include a "Prepare Ingredients" step. The app adds that automatically.
- Return ONLY the actual cooking steps.
- Each step must include only the ingredients used in that specific step.
- Ingredient format: "ingredient name: amount unit"
- If this page is not a recipe, return: {"error":"NOT_A_RECIPE"}

Return this exact structure:
{
  "name": "Recipe Name",
  "steps": [
    {
      "order": 1,
      "title": "Step Title",
      "description": "Detailed instructions for this step.",
      "duration_minutes": null,
      "ingredients_for_step": ["flour: 2 cups", "salt: 1 tsp"]
    }
  ],
  "ingredients": ["flour: 2 cups", "sugar: 1 cup"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Require JWT - no public access
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Missing or malformed Authorization header');
    return new Response(
      JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    console.error('JWT verification failed:', authError?.message ?? 'no user');
    return new Response(
      JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Authenticated user:', user.id);

  // Parse request body
  let url: string;
  try {
    const body = await req.json();
    url = body.url;
  } catch {
    return new Response(
      JSON.stringify({ error: 'BAD_REQUEST', message: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!url || !url.startsWith('http')) {
    return new Response(
      JSON.stringify({ error: 'BAD_REQUEST', message: 'A valid URL is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch the recipe page
  let html: string;
  try {
    console.log('Fetching URL:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeParser/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    html = await response.text();
  } catch (err: any) {
    console.error('Failed to fetch URL:', err.message);
    return new Response(
      JSON.stringify({ error: 'FETCH_FAILED', message: 'Could not retrieve the page' }),
      { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Strip scripts, styles, nav, footer — keep text content only
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

  // Call Claude
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return new Response(
      JSON.stringify({ error: 'CONFIG_ERROR', message: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let claudeResponse: any;
  try {
    console.log('Calling Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Parse this recipe page:\n\n${cleaned}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API ${response.status}: ${errText}`);
    }

    claudeResponse = await response.json();
  } catch (err: any) {
    console.error('Claude API call failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'API_FAILURE', message: 'AI service error' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Extract and parse the JSON from Claude's response
  const rawText = claudeResponse?.content?.[0]?.text ?? '';

  let parsed: any;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    console.error('Failed to parse Claude response:', err.message);
    console.error('Raw response:', rawText.substring(0, 500));
    return new Response(
      JSON.stringify({ error: 'PARSE_FAILURE', message: 'Failed to parse AI response' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (parsed.error === 'NOT_A_RECIPE') {
    return new Response(
      JSON.stringify({ error: 'NOT_A_RECIPE', message: 'This URL does not contain a recipe' }),
      { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!parsed.name || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    console.error('Invalid recipe structure:', JSON.stringify(parsed).substring(0, 300));
    return new Response(
      JSON.stringify({ error: 'PARSE_FAILURE', message: 'Could not extract a valid recipe' }),
      { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prepend "Prepare Ingredients" as step 0
  const prepStep = {
    order: 0,
    title: 'Prepare Ingredients',
    description: 'Gather and measure all ingredients before starting.',
    duration_minutes: null,
    ingredients_for_step: parsed.ingredients ?? [],
  };

  const finalSteps = [prepStep, ...parsed.steps.map((s: any, i: number) => ({
    order: s.order ?? i + 1,
    title: s.title ?? `Step ${i + 1}`,
    description: s.description ?? '',
    duration_minutes: s.duration_minutes ?? null,
    ingredients_for_step: s.ingredients_for_step ?? [],
  }))];

  console.log('Recipe parsed successfully:', parsed.name, '— steps:', finalSteps.length);

  return new Response(
    JSON.stringify({
      success: true,
      workflow: {
        name: parsed.name,
        steps: finalSteps,
        ingredients: parsed.ingredients ?? [],
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});