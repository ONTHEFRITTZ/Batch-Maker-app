/**
 * aiRecipeParser.ts
 * 
 * Single-pass AI-only recipe parser using Claude Haiku.
 * - Checks internet connectivity first
 * - Enforces rate limits via AsyncStorage (5/hr, 15/day)
 * - Calls Claude Haiku with raw recipe text
 * - Returns ingredients as an editable checklist
 * - Returns workflow steps ready to insert into Supabase
 * - Supports one automatic retry on failure
 * - Graceful error handling throughout
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
// If you don't have NetInfo installed, you can replace the connectivity
// check with a simple fetch to a known URL (see connectivityCheck below).

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

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const RATE_LIMIT_KEY = 'aiRecipeParser_rateLimits';

/** How many parses allowed per hour */
const LIMIT_PER_HOUR = 5;

/** How many parses allowed per day (rolling 24 hrs) */
const LIMIT_PER_DAY = 15;

/** Anthropic API endpoint */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Your Anthropic API key.
 * 
 * ⚠️  IMPORTANT: In production you should call your OWN backend which holds
 * the key server-side. Embedding it in client code exposes it.
 * For now (getting things working), this is fine.
 * Replace with your actual key:
 */
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';

/** Model to use — Haiku is cheapest and fast enough for this */
const MODEL = 'claude-haiku-4-5-20251001';

/** Max tokens for the response — recipes rarely need more */
const MAX_TOKENS = 2000;

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
// This is what tells Claude exactly what format to return.
// Keep it tight — every extra word costs tokens.

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

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

interface RateLimitRecord {
  timestamps: number[]; // epoch ms of each parse attempt
}

/**
 * Load the saved rate limit timestamps from AsyncStorage.
 */
async function loadRateLimits(): Promise<RateLimitRecord> {
  try {
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : [] };
    }
  } catch {
    // If storage is corrupted, start fresh — not a big deal
  }
  return { timestamps: [] };
}

/**
 * Save rate limit timestamps to AsyncStorage.
 */
async function saveRateLimits(record: RateLimitRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(record));
  } catch {
    // Silent fail — worst case we lose rate limit tracking temporarily
  }
}

/**
 * Check if the user has hit their rate limit.
 * Returns null if OK, or an error object if limited.
 * Also cleans up old timestamps while it's at it.
 */
async function checkRateLimit(): Promise<ParserError | null> {
  const record = await loadRateLimits();
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Filter out anything older than 24 hours (we don't need it)
  record.timestamps = record.timestamps.filter((ts) => ts > oneDayAgo);

  const inLastHour = record.timestamps.filter((ts) => ts > oneHourAgo).length;
  const inLastDay = record.timestamps.length;

  if (inLastHour >= LIMIT_PER_HOUR) {
    return {
      code: 'RATE_LIMITED',
      message: `You've parsed ${LIMIT_PER_HOUR} recipes in the last hour. Please wait a bit before trying again.`,
      retryable: false,
    };
  }

  if (inLastDay >= LIMIT_PER_DAY) {
    return {
      code: 'RATE_LIMITED',
      message: `You've reached the daily limit of ${LIMIT_PER_DAY} recipe parses. Try again tomorrow.`,
      retryable: false,
    };
  }

  // All good — save the cleaned-up record back
  await saveRateLimits(record);
  return null;
}

/**
 * Record a successful parse attempt (adds current timestamp).
 */
async function recordParse(): Promise<void> {
  const record = await loadRateLimits();
  record.timestamps.push(Date.now());
  await saveRateLimits(record);
}

// ─── CONNECTIVITY CHECK ─────────────────────────────────────────────────────

/**
 * Returns true if we have an internet connection.
 * 
 * Uses NetInfo if available. Falls back to a lightweight fetch
 * if NetInfo isn't installed or fails.
 */
async function hasInternet(): Promise<boolean> {
  try {
    // Primary: use React Native NetInfo
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return false;

    // Secondary: actually try to reach the API (catches cases where
    // NetInfo says connected but there's no real path to the server)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    await fetch('https://api.anthropic.com', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

// ─── API CALL ────────────────────────────────────────────────────────────────

/**
 * Calls Claude Haiku with the recipe text and returns the raw response string.
 * Throws on any HTTP or network error.
 */
async function callClaude(recipeText: string): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Parse this recipe:\n\n${recipeText}`,
      },
    ],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API returned ${response.status}: ${errorBody}`);
  }

  const json = await response.json();

  // Claude's response lives inside content[0].text
  const text = json?.content?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Claude API');
  }

  return text;
}

// ─── RESPONSE PARSING ────────────────────────────────────────────────────────

/**
 * Takes the raw text from Claude and turns it into a ParsedRecipe.
 * Handles cases where Claude might wrap JSON in markdown code fences
 * (even though we told it not to — it sometimes does anyway).
 */
function parseClaudeResponse(rawText: string): ParsedRecipe {
  // Strip any markdown code fences Claude might have added
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7); // remove ```json
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3); // remove ```
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
    estimated_cost: 0, // always 0, we don't know prices
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
 * Parse a recipe using Claude Haiku.
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

  // ── Step 2: Check rate limit
  const rateLimitError = await checkRateLimit();
  if (rateLimitError) {
    return { success: false, error: rateLimitError };
  }

  // ── Step 3: Call Claude + parse response (with one retry)
  let lastError: ParserError | null = null;

  const attemptParse = async (): Promise<ParserResult> => {
    try {
      const rawResponse = await callClaude(recipeText);
      const parsed = parseClaudeResponse(rawResponse);

      // Only record the parse AFTER success (don't penalise failed attempts)
      await recordParse();

      return { success: true, data: parsed };
    } catch (err: any) {
      const message = err?.message || 'Something went wrong';

      // Determine if this looks like an API issue vs a parse issue
      const isApiIssue =
        message.includes('Anthropic API') ||
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('timeout');

      lastError = {
        code: isApiIssue ? 'API_FAILURE' : 'PARSE_FAILURE',
        message: isApiIssue
          ? `Failed to reach the AI service. ${message}`
          : `Could not parse the recipe. ${message}`,
        retryable: true,
      };

      return { success: false, error: lastError };
    }
  };

  // First attempt
  const firstResult = await attemptParse();
  if (firstResult.success) return firstResult;

  // Retry once if allowed and the error is retryable
  if (allowRetry && firstResult.error.retryable) {
    // Small delay before retry so we're not hammering the API instantly
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const retryResult = await attemptParse();
    if (retryResult.success) return retryResult;

    // Both attempts failed — return the retry's error
    return retryResult;
  }

  // No retry allowed or not retryable
  return firstResult;
}

// ─── HELPER: Map parsed output to Supabase insert shapes ────────────────────
// These helpers make it easy to take the parser output and shove it straight
// into your Supabase tables. Use them in your screen/component code.

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
    steps: parsed.steps, // stored as JSONB in the workflows table
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Creates the object you'd pass to supabase.from('batch_templates').insert(...)
 * 
 * @param parsed - The ParsedRecipe from parseRecipe()
 * @param userId - The authenticated user's ID
 * @param workflowId - The ID of the workflow you just inserted (from the insert response)
 */
export function toBatchTemplateInsert(parsed: ParsedRecipe, userId: string, workflowId: string) {
  return {
    workflow_id: workflowId,
    user_id: userId,
    name: parsed.recipeName,
    ingredients: parsed.ingredients, // stored as JSONB
    servings: parsed.servings || null,
    total_estimated_minutes: parsed.totalEstimatedMinutes,
    created_at: new Date().toISOString(),
  };
}