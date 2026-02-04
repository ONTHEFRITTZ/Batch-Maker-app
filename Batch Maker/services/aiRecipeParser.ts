/**
 * aiRecipeParser.ts
 * 
 * Client-side recipe parser that calls your secure Supabase Edge Function.
 * - No API keys in the app (they're server-side now!)
 * - All rate limiting handled by the server
 * - Same clean interface as before
 * - Automatic retry on failure
 */

import { supabase } from './supabaseClient'; // Your Supabase client instance
import NetInfo from '@react-native-community/netinfo';

// ─── TYPES ───────────────────────────────────────────────────────────────────

/** One ingredient row — each field is editable by the user during batch execution */
export interface ParsedIngredient {
  name: string;
  amount: number;       // user can edit this in the UI
  unit: string;         // e.g. "g", "ml", "cups", "tbsp"
  estimated_cost?: number; // optional, leave 0 if unknown
}

/** One step in the workflow — maps directly to a step in the `steps` JSONB array */
export interface ParsedStep {
  order: number;        // 1-based sequence
  title: string;        // short name, e.g. "Preheat Oven"
  description: string;  // detailed instructions for this step
  duration_minutes: number; // 0 if not specified
  temperature?: number;     // omit or null if not relevant
  temperature_unit?: 'C' | 'F'; // Celsius or Fahrenheit
  notes?: string;       // any extra tips or warnings
}

/** Top-level output of a successful parse */
export interface ParsedRecipe {
  recipeName: string;
  description: string;
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
  totalEstimatedMinutes: number;
  servings?: string; // e.g. "12 muffins", "1 loaf"
}

/** Every possible error the parser can surface */
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
  retryable: boolean; // should the UI offer a retry button?
}

/** Wraps either a success or a failure */
export type ParserResult =
  | { success: true; data: ParsedRecipe }
  | { success: false; error: ParserError };

// ─── CONNECTIVITY CHECK ──────────────────────────────────────────────────────

/**
 * Returns true if we have an internet connection.
 */
async function hasInternet(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return false;

    // Quick ping to check real connectivity
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch('https://www.google.com', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

// ─── EDGE FUNCTION CALL ──────────────────────────────────────────────────────

/**
 * Calls your Supabase Edge Function with the recipe text.
 * Returns the raw response string from Claude.
 */
async function callEdgeFunction(recipeText: string): Promise<string> {
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  // Call your edge function
  // Replace 'parse-recipe' with your function name if different
  const { data, error } = await supabase.functions.invoke('parse-recipe', {
    body: { recipeText },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    // Edge function returned an error
    throw new Error(error.message || 'Edge function call failed');
  }

  // The edge function returns { success: true, responseText: "..." }
  // or { error: "...", message: "..." }
  if (data.error) {
    // Server returned a structured error
    const err = new Error(data.message || 'Unknown error from server');
    (err as any).code = data.error; // attach the error code
    throw err;
  }

  if (!data.responseText) {
    throw new Error('Empty response from server');
  }

  return data.responseText;
}

// ─── RESPONSE PARSING ────────────────────────────────────────────────────────

/**
 * Takes the raw text from Claude and turns it into a ParsedRecipe.
 * Handles cases where Claude might wrap JSON in markdown code fences.
 */
function parseClaudeResponse(rawText: string): ParsedRecipe {
  // Strip any markdown code fences Claude might have added
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

  // If Claude decided it's not a recipe, surface that
  if (parsed.error === 'not_a_recipe') {
    throw new Error(parsed.message || 'The text does not appear to be a recipe.');
  }

  // Validate the minimum shape we need
  if (!parsed.recipeName || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.steps)) {
    throw new Error('Response is missing required fields (recipeName, ingredients, or steps).');
  }

  // Ensure all ingredients have the right shape
  const ingredients: ParsedIngredient[] = parsed.ingredients.map((ing: any) => ({
    name: String(ing.name || 'Unknown ingredient'),
    amount: Number(ing.amount) || 0,
    unit: String(ing.unit || 'unknown'),
    estimated_cost: 0,
  }));

  // Ensure all steps have the right shape
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

  // Sort steps by order just in case
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

/**
 * Parse a recipe using Claude Haiku (via secure edge function).
 * 
 * @param recipeText - The raw recipe text (from user input, clipboard, whatever)
 * @param allowRetry - If true (default), automatically retries once on API/parse failure
 * @returns A ParserResult — either success with the parsed recipe, or failure with an error
 * 
 * Usage:
 *   const result = await parseRecipe(userInput);
 *   if (result.success) {
 *     console.log(result.data.recipeName);
 *     console.log(result.data.ingredients); // editable checklist
 *     console.log(result.data.steps);       // ready for Supabase insert
 *   } else {
 *     console.log(result.error.message);
 *   }
 */
export async function parseRecipe(
  recipeText: string,
  allowRetry: boolean = true
): Promise<ParserResult> {
  // ── Guard: empty input
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

  // ── Step 1: Check internet
  const online = await hasInternet();
  if (!online) {
    return {
      success: false,
      error: {
        code: 'NO_INTERNET',
        message: 'No internet connection. Recipe parsing requires an internet connection. Check your Wi-Fi or cellular data and try again.',
        retryable: true,
      },
    };
  }

  // ── Step 2: Call edge function + parse response (with one retry)
  const attemptParse = async (): Promise<ParserResult> => {
    try {
      const rawResponse = await callEdgeFunction(recipeText);
      const parsed = parseClaudeResponse(rawResponse);
      return { success: true, data: parsed };
    } catch (err: any) {
      const message = err?.message || 'Something went wrong';
      const errorCode = (err as any).code;

      // Map server error codes to client error codes
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

      // Check if it's an API issue or parse issue
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

  // First attempt
  const firstResult = await attemptParse();
  if (firstResult.success) return firstResult;

  // Retry once if allowed and the error is retryable
  if (allowRetry && firstResult.error.retryable) {
    // Small delay before retry
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const retryResult = await attemptParse();
    if (retryResult.success) return retryResult;

    return retryResult;
  }

  return firstResult;
}

// ─── HELPER: Map parsed output to Supabase insert shapes ────────────────────

/**
 * Creates the object you'd pass to supabase.from('workflows').insert(...)
 * 
 * @param parsed - The ParsedRecipe from parseRecipe()
 * @param userId - The authenticated user's ID
 */
export function toWorkflowInsert(parsed: ParsedRecipe, userId: string) {
  return {
    name: parsed.recipeName,
    description: parsed.description,
    user_id: userId,
    steps: parsed.steps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Creates the object you'd pass to supabase.from('batch_templates').insert(...)
 * 
 * @param parsed - The ParsedRecipe from parseRecipe()
 * @param userId - The authenticated user's ID
 * @param workflowId - The ID of the workflow you just inserted
 */
export function toBatchTemplateInsert(parsed: ParsedRecipe, userId: string, workflowId: string) {
  return {
    workflow_id: workflowId,
    user_id: userId,
    name: parsed.recipeName,
    ingredients: parsed.ingredients,
    servings: parsed.servings || null,
    total_estimated_minutes: parsed.totalEstimatedMinutes,
    created_at: new Date().toISOString(),
  };
}