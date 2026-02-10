/**
 * aiRecipeParser.ts
 * Location: batch-maker-website/lib/aiRecipeParser.ts
 */

import { getSupabaseClient } from '../lib/supabase';

const supabase = getSupabaseClient();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedIngredient {
  name: string;
  amount: string;
  unit: string;
  estimated_cost?: number;
}

export interface ParsedStep {
  order: number;
  title: string;
  description: string;
  duration_minutes: number | null;
  temperature?: number;
  temperature_unit?: 'C' | 'F';
  notes?: string;
  ingredients_for_step?: string[];
}

export interface ParsedRecipe {
  recipeName: string;
  description: string;
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
  totalEstimatedMinutes: number;
  servings?: string;
}

export type ParserErrorCode =
  | 'NO_INTERNET'
  | 'RATE_LIMITED'
  | 'API_FAILURE'
  | 'PARSE_FAILURE'
  | 'UNAUTHORIZED'
  | 'NOT_A_RECIPE'
  | 'DATABASE_ERROR'
  | 'UNKNOWN';

export interface ParserError {
  code: ParserErrorCode;
  message: string;
  retryable: boolean;
}

export type ParserResult =
  | { success: true; data: ParsedRecipe }
  | { success: false; error: ParserError };

export interface SaveRecipeResult {
  success: boolean;
  workflowId?: string;
  error?: ParserErrorCode;
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIVITY CHECK
// ─────────────────────────────────────────────────────────────────────────────

async function hasInternet(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE PARSING
// Edge function returns ingredients as string[] e.g. ["flour: 2 cups"]
// This converts them to ParsedIngredient objects
// ─────────────────────────────────────────────────────────────────────────────

function parseIngredientString(raw: string): ParsedIngredient {
  const colonIndex = raw.indexOf(':');
  if (colonIndex === -1) {
    return { name: raw.trim(), amount: '', unit: '' };
  }

  const name = raw.substring(0, colonIndex).trim();
  const rest = raw.substring(colonIndex + 1).trim();
  const parts = rest.split(' ');
  const amount = parts[0] ?? '';
  const unit = parts.slice(1).join(' ');

  return { name, amount, unit };
}

function parseWorkflowResponse(data: any): ParsedRecipe {
  if (!data.workflow) {
    throw new Error('Invalid response format from server');
  }

  const workflow = data.workflow;

  if (!workflow.name || !Array.isArray(workflow.steps)) {
    throw new Error('Incomplete recipe data in server response');
  }

  // Full ingredient list from the top-level ingredients array.
  // Edge function returns these as strings: "flour: 2 cups"
  const rawIngredients: string[] = Array.isArray(workflow.ingredients)
    ? workflow.ingredients
    : [];

  const ingredients: ParsedIngredient[] = rawIngredients.map(parseIngredientString);

  // Steps come in already ordered with step 0 = "Prepare Ingredients".
  // step 0's ingredients_for_step is the full ingredient list as a checklist.
  // steps 1-N each have only their own ingredients_for_step.
  const steps: ParsedStep[] = workflow.steps.map((s: any, i: number) => ({
    order: s.order ?? i,
    title: s.title ?? (s.order === 0 ? 'Prepare Ingredients' : `Step ${i}`),
    description: s.description ?? '',
    duration_minutes: s.duration_minutes ?? null,
    ingredients_for_step: Array.isArray(s.ingredients_for_step) ? s.ingredients_for_step : [],
  }));

  // Only sum durations for actual recipe steps, not step 0
  const totalEstimatedMinutes = steps.reduce(
    (sum, s) => (s.order === 0 ? sum : sum + (s.duration_minutes ?? 0)),
    0
  );

  return {
    recipeName: workflow.name,
    description: workflow.description ?? '',
    ingredients,
    steps,
    totalEstimatedMinutes,
    servings: workflow.servings ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EDGE FUNCTION CALLERS
// ─────────────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw Object.assign(new Error('Not authenticated. Please sign in first.'), {
      code: 'UNAUTHORIZED',
    });
  }

  return session.access_token;
}

async function callParseTextEdgeFunction(recipeText: string): Promise<any> {
  const token = await getAccessToken();

  const { data, error } = await supabase.functions.invoke('parse-recipe', {
    body: { recipeText },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    throw new Error(error.message || 'Edge function call failed');
  }

  if (data?.error) {
    throw Object.assign(new Error(data.message || 'Server error'), { code: data.error });
  }

  return data;
}

async function callParseUrlEdgeFunction(url: string): Promise<any> {
  const token = await getAccessToken();

  const { data, error } = await supabase.functions.invoke('parse-recipe-url', {
    body: { url },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    throw new Error(error.message || 'Edge function call failed');
  }

  if (data?.error) {
    throw Object.assign(new Error(data.message || 'Server error'), { code: data.error });
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR MAPPER
// ─────────────────────────────────────────────────────────────────────────────

function mapError(err: any, context: 'text' | 'url'): ParserError {
  const message: string = err?.message ?? 'Something went wrong';
  const code: string = err?.code ?? '';

  if (code === 'RATE_LIMITED') {
    return { code: 'RATE_LIMITED', message, retryable: false };
  }

  if (code === 'NOT_A_RECIPE') {
    return { code: 'NOT_A_RECIPE', message, retryable: false };
  }

  if (code === 'UNAUTHORIZED' || message.includes('Not authenticated')) {
    return {
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to parse recipes.',
      retryable: false,
    };
  }

  const isApiIssue =
    code === 'API_FAILURE' ||
    code === 'FETCH_FAILED' ||
    message.toLowerCase().includes('fetch') ||
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('timeout');

  if (isApiIssue) {
    return {
      code: 'API_FAILURE',
      message: context === 'url'
        ? `Failed to reach the recipe URL. ${message}`
        : `Failed to reach the AI service. ${message}`,
      retryable: true,
    };
  }

  return {
    code: 'PARSE_FAILURE',
    message: `Could not parse the recipe. ${message}`,
    retryable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE FROM TEXT
// ─────────────────────────────────────────────────────────────────────────────

export async function parseRecipe(
  recipeText: string,
  allowRetry: boolean = true
): Promise<ParserResult> {
  if (!recipeText?.trim()) {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILURE',
        message: 'No recipe text provided.',
        retryable: false,
      },
    };
  }

  if (!(await hasInternet())) {
    return {
      success: false,
      error: {
        code: 'NO_INTERNET',
        message: 'No internet connection. Recipe parsing requires an internet connection.',
        retryable: true,
      },
    };
  }

  const attempt = async (): Promise<ParserResult> => {
    try {
      const data = await callParseTextEdgeFunction(recipeText);
      return { success: true, data: parseWorkflowResponse(data) };
    } catch (err: any) {
      return { success: false, error: mapError(err, 'text') };
    }
  };

  const first = await attempt();
  if (first.success) return first;

  const firstFailed = first as { success: false; error: ParserError };
  if (allowRetry && firstFailed.error.retryable) {
    await new Promise((r) => setTimeout(r, 2000));
    return attempt();
  }

  return first;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE FROM URL
// ─────────────────────────────────────────────────────────────────────────────

export async function parseRecipeFromUrl(
  url: string,
  allowRetry: boolean = true
): Promise<ParserResult> {
  if (!url?.trim()) {
    return {
      success: false,
      error: { code: 'PARSE_FAILURE', message: 'No URL provided.', retryable: false },
    };
  }

  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILURE',
        message: 'Invalid URL format.',
        retryable: false,
      },
    };
  }

  if (!(await hasInternet())) {
    return {
      success: false,
      error: {
        code: 'NO_INTERNET',
        message: 'No internet connection.',
        retryable: true,
      },
    };
  }

  const attempt = async (): Promise<ParserResult> => {
    try {
      const data = await callParseUrlEdgeFunction(url);
      return { success: true, data: parseWorkflowResponse(data) };
    } catch (err: any) {
      return { success: false, error: mapError(err, 'url') };
    }
  };

  const first = await attempt();
  if (first.success) return first;

  const firstFailed = first as { success: false; error: ParserError };
  if (allowRetry && firstFailed.error.retryable) {
    await new Promise((r) => setTimeout(r, 2000));
    return attempt();
  }

  return first;
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE FROM TEXT
// ─────────────────────────────────────────────────────────────────────────────

export async function saveRecipeFromText(
  recipeText: string,
  locationId?: string
): Promise<SaveRecipeResult> {
  const parseResult = await parseRecipe(recipeText);

  if (!parseResult.success) {
    const failed = parseResult as { success: false; error: ParserError };
    return {
      success: false,
      error: failed.error.code,
      message: failed.error.message,
    };
  }

  const succeeded = parseResult as { success: true; data: ParsedRecipe };
  return saveWorkflow(succeeded.data, locationId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE FROM URL
// ─────────────────────────────────────────────────────────────────────────────

export async function saveRecipeFromUrl(
  url: string,
  locationId?: string
): Promise<SaveRecipeResult> {
  const parseResult = await parseRecipeFromUrl(url);

  if (!parseResult.success) {
    const failed = parseResult as { success: false; error: ParserError };
    return {
      success: false,
      error: failed.error.code,
      message: failed.error.message,
    };
  }

  const succeeded = parseResult as { success: true; data: ParsedRecipe };
  return saveWorkflow(succeeded.data, locationId, url);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SAVE LOGIC
// ─────────────────────────────────────────────────────────────────────────────

async function saveWorkflow(
  parsed: ParsedRecipe,
  locationId?: string,
  sourceUrl?: string
): Promise<SaveRecipeResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'You must be signed in to save recipes.',
    };
  }

  const workflowId = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const { error: insertError } = await supabase.from('workflows').insert({
      id: workflowId,
      user_id: user.id,
      location_id: locationId ?? null,
      name: parsed.recipeName,
      description: parsed.description,
      servings: parsed.servings ?? null,
      total_time_minutes: parsed.totalEstimatedMinutes,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      source_url: sourceUrl ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Workflow insert error:', insertError);
      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: `Failed to save recipe: ${insertError.message}`,
      };
    }

    return {
      success: true,
      workflowId,
      message: `Imported "${parsed.recipeName}"`,
    };
  } catch (err: any) {
    console.error('Save workflow error:', err);
    return {
      success: false,
      error: 'UNKNOWN',
      message: err?.message ?? 'Failed to save recipe',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function toWorkflowInsert(parsed: ParsedRecipe, userId: string, locationId?: string) {
  return {
    name: parsed.recipeName,
    description: parsed.description,
    user_id: userId,
    location_id: locationId ?? null,
    steps: parsed.steps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function toBatchTemplateInsert(parsed: ParsedRecipe, userId: string, workflowId: string) {
  return {
    workflow_id: workflowId,
    created_by: userId,
    workflow_name: parsed.recipeName,
    name: parsed.recipeName,
    description: parsed.description,
    steps: parsed.steps,
    ingredients_used: parsed.ingredients,
    batch_size_multiplier: 1,
    estimated_duration: parsed.totalEstimatedMinutes,
    times_used: 0,
    created_at: new Date().toISOString(),
  };
}