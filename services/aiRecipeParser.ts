/**
 * aiRecipeParser.ts - PRODUCTION VERSION
 * 
 * Client-side recipe parser that calls your secure Supabase Edge Function.
 * - No API keys in the app (server-side only)
 * - All rate limiting handled by server
 * - Proper workflow structure for database insert
 * - Automatic retry on failure
 */

import { supabase } from './supabaseClient';
import NetInfo from '@react-native-community/netinfo';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ParsedIngredient {
  name: string;
  amount: string;        // Changed to string to match database
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
  | 'NOT_A_RECIPE'
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
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return false;

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

async function callEdgeFunction(recipeText: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  console.log('Calling parse-recipe edge function...');

  const { data, error } = await supabase.functions.invoke('parse-recipe', {
    body: { recipeText },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(error.message || 'Edge function call failed');
  }

  if (data.error) {
    const err = new Error(data.message || 'Unknown error from server');
    (err as any).code = data.error;
    throw err;
  }

  return data;
}

// ─── RESPONSE PARSING ────────────────────────────────────────────────────────

function parseRecipeResponse(data: any): ParsedRecipe {
  // The edge function should return { success: true, workflow: {...} }
  if (!data.success || !data.workflow) {
    throw new Error('Invalid response structure from server');
  }

  const workflow = data.workflow;

  // Validate minimum required fields
  if (!workflow.name || !Array.isArray(workflow.ingredients) || !Array.isArray(workflow.steps)) {
    throw new Error('Response is missing required fields (name, ingredients, or steps)');
  }

  // Transform to ParsedRecipe format
  const ingredients: ParsedIngredient[] = workflow.ingredients.map((ing: any) => ({
    name: String(ing.name || 'Unknown ingredient'),
    amount: String(ing.amount || '0'),
    unit: String(ing.unit || ''),
    estimated_cost: ing.estimated_cost || 0,
  }));

  const steps: ParsedStep[] = workflow.steps.map((step: any, index: number) => ({
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
    recipeName: String(workflow.name),
    description: String(workflow.description || ''),
    ingredients,
    steps,
    totalEstimatedMinutes: Number(workflow.total_time_minutes) || 0,
    servings: workflow.servings ? String(workflow.servings) : undefined,
  };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Parse a recipe using Claude Haiku (via secure edge function).
 * 
 * @param recipeText - The raw recipe text
 * @param allowRetry - If true, automatically retries once on failure
 * @returns ParserResult with either parsed recipe or error
 */
export async function parseRecipe(
  recipeText: string,
  allowRetry: boolean = true
): Promise<ParserResult> {
  // Guard: empty input
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

  // Check internet
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

  // Attempt parse
  const attemptParse = async (): Promise<ParserResult> => {
    try {
      const data = await callEdgeFunction(recipeText);
      const parsed = parseRecipeResponse(data);
      return { success: true, data: parsed };
    } catch (err: any) {
      const message = err?.message || 'Something went wrong';
      const errorCode = (err as any).code;

      console.error('Parse attempt failed:', errorCode, message);

      // Map server error codes
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

      if (errorCode === 'NOT_A_RECIPE') {
        return {
          success: false,
          error: {
            code: 'NOT_A_RECIPE',
            message: message,
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

  // Retry once if allowed and retryable
  if (allowRetry && firstResult.error.retryable) {
    console.log('Retrying parse...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const retryResult = await attemptParse();
    return retryResult;
  }

  return firstResult;
}

// ─── HELPER: Save to Database ────────────────────────────────────────────────

/**
 * Parse a recipe and save it directly to the database as a workflow
 * 
 * @param recipeText - The raw recipe text
 * @returns Object with success status and workflow ID
 */
export async function parseAndSaveRecipe(recipeText: string): Promise<{
  success: boolean;
  workflowId?: string;
  error?: string;
}> {
  try {
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: 'You must be signed in to save recipes'
      };
    }

    // Parse the recipe
    const parseResult = await parseRecipe(recipeText);
    
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.message
      };
    }

    const parsed = parseResult.data;

    // Generate workflow ID
    const workflowId = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Insert into database
    const { data: workflow, error: insertError } = await supabase
      .from('workflows')
      .insert({
        id: workflowId,
        user_id: session.user.id,
        name: parsed.recipeName,
        description: parsed.description,
        servings: parsed.servings || null,
        total_time_minutes: parsed.totalEstimatedMinutes,
        ingredients: parsed.ingredients,
        steps: parsed.steps,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return {
        success: false,
        error: `Failed to save recipe: ${insertError.message}`
      };
    }

    console.log('Recipe saved as workflow:', workflowId);

    return {
      success: true,
      workflowId: workflowId
    };

  } catch (error: any) {
    console.error('Error in parseAndSaveRecipe:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Creates the workflow insert object (for manual control)
 * 
 * @param parsed - The ParsedRecipe from parseRecipe()
 * @param userId - The authenticated user's ID
 */
export function toWorkflowInsert(parsed: ParsedRecipe, userId: string) {
  return {
    id: `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    name: parsed.recipeName,
    description: parsed.description,
    servings: parsed.servings || null,
    total_time_minutes: parsed.totalEstimatedMinutes,
    ingredients: parsed.ingredients,
    steps: parsed.steps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}