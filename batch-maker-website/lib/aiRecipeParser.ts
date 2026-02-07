/**
 * aiRecipeParser.ts (Web Version) - COMPLETE VERSION WITH SAVE FUNCTIONS
 * 
 * Location: batch-maker-website/lib/aiRecipeParser.ts
 */

import { getSupabaseClient } from '../lib/supabase';

const supabase = getSupabaseClient();

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface ParsedIngredient {
  name: string;
  amount: string; // Changed to string to support fractions
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

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTIVITY CHECK
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION CALLS
// ═══════════════════════════════════════════════════════════════════════════

async function callParseTextEdgeFunction(recipeText: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  
  console.log('🔍 Session check:', {
    hasSession: !!session,
    user: session?.user?.email,
    hasToken: !!session?.access_token
  });
  
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

  return data;
}

async function callParseUrlEdgeFunction(url: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  
  console.log('🔍 URL Parser - Session check:', {
    hasSession: !!session,
    user: session?.user?.email,
    hasToken: !!session?.access_token,
    tokenLength: session?.access_token?.length
  });
  
  if (!session) {
    console.error('❌ No session found - user is not logged in');
    throw new Error('Not authenticated. Please sign in first.');
  }

  if (!session.access_token) {
    console.error('❌ Session exists but no access token');
    throw new Error('Invalid session. Please sign out and sign in again.');
  }

  console.log('✅ Sending request with auth token');

  const { data, error } = await supabase.functions.invoke('parse-recipe-url', {
    body: { url },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('❌ Edge function error:', error);
    throw new Error(error.message || 'Failed to fetch recipe from URL');
  }

  if (data.error) {
    const err = new Error(data.message || 'Unknown error from server');
    (err as any).code = data.error;
    throw err;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE PARSING
// ═══════════════════════════════════════════════════════════════════════════

function parseWorkflowResponse(data: any): ParsedRecipe {
  // The FINAL Edge Function returns { success: true, workflow: {...}, user_id: "..." }
  if (!data.workflow) {
    throw new Error('Invalid response format from server');
  }

  const workflow = data.workflow;

  return {
    recipeName: workflow.name,
    description: workflow.description || '',
    ingredients: workflow.ingredients || [],
    steps: workflow.steps || [],
    totalEstimatedMinutes: workflow.total_time_minutes || 0,
    servings: workflow.servings || undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSE RECIPE FROM TEXT
// ═══════════════════════════════════════════════════════════════════════════

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
      const data = await callParseTextEdgeFunction(recipeText);
      const parsed = parseWorkflowResponse(data);
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

  const errorResult = firstResult as { success: false; error: ParserError };
  if (allowRetry && errorResult.error.retryable) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await attemptParse();
  }

  return firstResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSE RECIPE FROM URL
// ═══════════════════════════════════════════════════════════════════════════

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
      const data = await callParseUrlEdgeFunction(url);
      const parsed = parseWorkflowResponse(data);
      return { success: true, data: parsed };
    } catch (err: any) {
      const message = err?.message || 'Something went wrong';
      const errorCode = (err as any).code;

      console.error('❌ Parse error:', { message, errorCode, err });

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

      if (errorCode === 'UNAUTHORIZED' || message.includes('Not authenticated')) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You must be signed in to parse recipes. Please log in and try again.',
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

  const errorResult = firstResult as { success: false; error: ParserError };
  if (allowRetry && errorResult.error.retryable) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await attemptParse();
  }

  return firstResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE RECIPE FROM TEXT
// ═══════════════════════════════════════════════════════════════════════════

export async function saveRecipeFromText(
  recipeText: string,
  locationId?: string
): Promise<SaveRecipeResult> {
  // Step 1: Parse the recipe
  const parseResult = await parseRecipe(recipeText);
  
  if (parseResult.success === false) {
    return {
      success: false,
      error: parseResult.error.code,
      message: parseResult.error.message,
    };
  }

  // Step 2: Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'You must be signed in to save recipes.',
    };
  }

  // Step 3: Generate workflow ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const workflowId = `wf-${timestamp}-${random}`;

  // Step 4: Insert into workflows table
  try {
    const { error: insertError } = await supabase
      .from('workflows')
      .insert({
        id: workflowId,
        user_id: user.id,
        location_id: locationId || null,
        name: parseResult.data.recipeName,
        description: parseResult.data.description,
        servings: parseResult.data.servings || null,
        total_time_minutes: parseResult.data.totalEstimatedMinutes,
        ingredients: parseResult.data.ingredients,
        steps: parseResult.data.steps,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: `Failed to save recipe: ${insertError.message}`,
      };
    }

    return {
      success: true,
      workflowId,
      message: `Successfully imported "${parseResult.data.recipeName}"`,
    };

  } catch (err: any) {
    console.error('❌ Save error:', err);
    return {
      success: false,
      error: 'UNKNOWN',
      message: err?.message || 'Failed to save recipe',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE RECIPE FROM URL
// ═══════════════════════════════════════════════════════════════════════════

export async function saveRecipeFromUrl(
  url: string,
  locationId?: string
): Promise<SaveRecipeResult> {
  // Step 1: Parse the recipe
  const parseResult = await parseRecipeFromUrl(url);
  
 if (parseResult.success === false) {
    return {
      success: false,
      error: parseResult.error.code,
      message: parseResult.error.message,
    };
  }

  // Step 2: Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'You must be signed in to save recipes.',
    };
  }

  // Step 3: Generate workflow ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const workflowId = `wf-${timestamp}-${random}`;

  // Step 4: Insert into workflows table
  try {
    const { error: insertError } = await supabase
      .from('workflows')
      .insert({
        id: workflowId,
        user_id: user.id,
        location_id: locationId || null,
        name: parseResult.data.recipeName,
        description: parseResult.data.description,
        servings: parseResult.data.servings || null,
        total_time_minutes: parseResult.data.totalEstimatedMinutes,
        ingredients: parseResult.data.ingredients,
        steps: parseResult.data.steps,
        source_url: url, // Save the source URL
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: `Failed to save recipe: ${insertError.message}`,
      };
    }

    return {
      success: true,
      workflowId,
      message: `Successfully imported "${parseResult.data.recipeName}"`,
    };

  } catch (err: any) {
    console.error('❌ Save error:', err);
    return {
      success: false,
      error: 'UNKNOWN',
      message: err?.message || 'Failed to save recipe',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY HELPER FUNCTIONS (kept for backwards compatibility)
// ═══════════════════════════════════════════════════════════════════════════

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