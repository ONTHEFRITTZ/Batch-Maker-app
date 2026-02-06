/**
 * aiRecipeParser.ts (Web Version)
 */

import { supabase } from './supabase';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ParsedIngredient {
  name: string;
  amount: number;
  unit: string;
  estimated_cost?: number;
}

export interface ParsedStep {
  order: number;
  title: string;
  description: string;
  duration_minutes: number;
  temperature?: number;
  temperature_unit?: 'C' | 'F';
  notes?: string;
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
  | 'UNKNOWN';

export interface ParserError {
  code: ParserErrorCode;
  message: string;
  retryable: boolean;
}

export type ParserResult =
  | { success: true; data: ParsedRecipe }
  | { success: false; error: ParserError };

// ─── CONNECTIVITY CHECK ──────────────────────────────────────────────────────

async function hasInternet(): Promise<boolean> {
  try {
    if (!navigator.onLine) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

// ─── EDGE FUNCTION CALL ──────────────────────────────────────────────────────

async function callEdgeFunction(recipeText: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  const { data, error } = await supabase.functions.invoke('parse-recipe', {
    body: { recipeText },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Edge function call failed');
  }

  if (data.error) {
    const err = new Error(data.message || 'Unknown error from server');
    (err as any).code = data.error;
    throw err;
  }

  if (!data.responseText) {
    throw new Error('Empty response from server');
  }

  return data.responseText;
}

// ─── RESPONSE PARSING ────────────────────────────────────────────────────────

function parseClaudeResponse(rawText: string): ParsedRecipe {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  if (parsed.error === 'not_a_recipe') {
    throw new Error(parsed.message || 'The text does not appear to be a recipe.');
  }

  if (!parsed.recipeName || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.steps)) {
    throw new Error('Response is missing required fields (recipeName, ingredients, or steps).');
  }

  const ingredients: ParsedIngredient[] = parsed.ingredients.map((ing: any) => ({
    name: String(ing.name || 'Unknown ingredient'),
    amount: Number(ing.amount) || 0,
    unit: String(ing.unit || 'unknown'),
    estimated_cost: 0,
  }));

  const steps: ParsedStep[] = parsed.steps.map((step: any, index: number) => ({
    order: Number(step.order) || index + 1,
    title: String(step.title || `Step ${index + 1}`),
    description: String(step.description || ''),
    duration_minutes: Number(step.duration_minutes) || 0,
    temperature: step.temperature != null ? Number(step.temperature) : undefined,
    temperature_unit: step.temperature_unit === 'C' || step.temperature_unit === 'F'
      ? step.temperature_unit
      : undefined,
    notes: step.notes ? String(step.notes) : undefined,
  }));

  steps.sort((a, b) => a.order - b.order);

  return {
    recipeName: String(parsed.recipeName),
    description: String(parsed.description || ''),
    ingredients,
    steps,
    totalEstimatedMinutes: Number(parsed.totalEstimatedMinutes) || 0,
    servings: parsed.servings ? String(parsed.servings) : undefined,
  };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function parseRecipe(
  recipeText: string,
  allowRetry: boolean = true
): Promise<ParserResult> {
  if (!recipeText || recipeText.trim().length === 0) {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILURE',
        message: 'No recipe text provided. Paste or type a recipe first.',
        retryable: false,
      },
    };
  }

  const online = await hasInternet();
  if (!online) {
    return {
      success: false,
      error: {
        code: 'NO_INTERNET',
        message: 'No internet connection. Recipe parsing requires an internet connection.',
        retryable: true,
      },
    };
  }

  const attemptParse = async (): Promise<ParserResult> => {
    try {
      const rawResponse = await callEdgeFunction(recipeText);
      const parsed = parseClaudeResponse(rawResponse);
      return { success: true, data: parsed };
    } catch (err: any) {
      const message = err?.message || 'Something went wrong';
      const errorCode = (err as any).code;

      if (errorCode === 'RATE_LIMITED') {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: message,
            retryable: false,
          },
        };
      }

      if (errorCode === 'UNAUTHORIZED' || message.includes('Not authenticated')) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You must be signed in to parse recipes.',
            retryable: false,
          },
        };
      }

      const isApiIssue =
        errorCode === 'API_FAILURE' ||
        message.includes('Edge function') ||
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('AI service');

      return {
        success: false,
        error: {
          code: isApiIssue ? 'API_FAILURE' : 'PARSE_FAILURE',
          message: isApiIssue
            ? `Failed to reach the AI service. ${message}`
            : `Could not parse the recipe. ${message}`,
          retryable: true,
        },
      };
    }
  };

  const firstResult = await attemptParse();
  if (firstResult.success) return firstResult;

  // Cast to error type since we know success is false
  const errorResult = firstResult as { success: false; error: ParserError };
  if (allowRetry && errorResult.error.retryable) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await attemptParse();
  }

  return firstResult;
}

// ─── URL PARSER ──────────────────────────────────────────────────────────────

export async function parseRecipeFromUrl(
  url: string,
  allowRetry: boolean = true
): Promise<ParserResult> {
  if (!url || url.trim().length === 0) {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILURE',
        message: 'No URL provided. Please enter a recipe URL.',
        retryable: false,
      },
    };
  }

  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILURE',
        message: 'Invalid URL format. Please enter a valid recipe URL.',
        retryable: false,
      },
    };
  }

  const online = await hasInternet();
  if (!online) {
    return {
      success: false,
      error: {
        code: 'NO_INTERNET',
        message: 'No internet connection. Recipe parsing requires an internet connection.',
        retryable: true,
      },
    };
  }

  const attemptParse = async (): Promise<ParserResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated. Please sign in first.');
      }

      const { data, error } = await supabase.functions.invoke('parse-recipe-url', {
        body: { url },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch recipe from URL');
      }

      if (data.error) {
        const err = new Error(data.message || 'Unknown error from server');
        (err as any).code = data.error;
        throw err;
      }

      if (!data.responseText) {
        throw new Error('Empty response from server');
      }

      const parsed = parseClaudeResponse(data.responseText);
      return { success: true, data: parsed };
    } catch (err: any) {
      const message = err?.message || 'Something went wrong';
      const errorCode = (err as any).code;

      if (errorCode === 'RATE_LIMITED') {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: message,
            retryable: false,
          },
        };
      }

      if (errorCode === 'UNAUTHORIZED' || message.includes('Not authenticated')) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You must be signed in to parse recipes.',
            retryable: false,
          },
        };
      }

      const isApiIssue =
        errorCode === 'API_FAILURE' ||
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('timeout');

      return {
        success: false,
        error: {
          code: isApiIssue ? 'API_FAILURE' : 'PARSE_FAILURE',
          message: isApiIssue
            ? `Failed to reach the recipe URL. ${message}`
            : `Could not parse the recipe. ${message}`,
          retryable: true,
        },
      };
    }
  };

  const firstResult = await attemptParse();
  if (firstResult.success) return firstResult;

  // Cast to error type since we know success is false
  const errorResult = firstResult as { success: false; error: ParserError };
  if (allowRetry && errorResult.error.retryable) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await attemptParse();
  }

  return firstResult;
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

export function toWorkflowInsert(parsed: ParsedRecipe, userId: string, locationId?: string) {
  return {
    name: parsed.recipeName,
    description: parsed.description,
    user_id: userId,
    location_id: locationId || null,
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