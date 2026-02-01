// ============================================================
// services/aiRecipeParser.ts
// AI-powered recipe import with two-pass parsing + rate limiting
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';

const client = new Anthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '',
});

// ============================================================
// RATE LIMITING
// ============================================================
const RATE_LIMIT_KEY = 'ai_recipe_parser_rate_limit';
const MAX_CALLS_PER_HOUR = 5;       // Max AI calls per user per hour
const MAX_CALLS_PER_DAY = 15;       // Max AI calls per user per day
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface RateLimitRecord {
  calls: { timestamp: number }[];
}

async function getRateLimitRecord(): Promise<RateLimitRecord> {
  try {
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { calls: [] };
}

async function saveRateLimitRecord(record: RateLimitRecord) {
  await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(record));
}

export async function checkRateLimit(): Promise<{ allowed: boolean; reason?: string; hourlyRemaining: number; dailyRemaining: number }> {
  const record = await getRateLimitRecord();
  const now = Date.now();

  // Prune old entries older than 24 hours
  record.calls = record.calls.filter(c => now - c.timestamp < DAY_MS);

  const hourlyCalls = record.calls.filter(c => now - c.timestamp < HOUR_MS).length;
  const dailyCalls = record.calls.length;

  if (hourlyCalls >= MAX_CALLS_PER_HOUR) {
    return { allowed: false, reason: 'Hourly limit reached. Please wait before parsing another recipe.', hourlyRemaining: 0, dailyRemaining: MAX_CALLS_PER_DAY - dailyCalls };
  }
  if (dailyCalls >= MAX_CALLS_PER_DAY) {
    return { allowed: false, reason: 'Daily limit reached. Try again tomorrow.', hourlyRemaining: MAX_CALLS_PER_HOUR - hourlyCalls, dailyRemaining: 0 };
  }

  return { allowed: true, hourlyRemaining: MAX_CALLS_PER_HOUR - hourlyCalls, dailyRemaining: MAX_CALLS_PER_DAY - dailyCalls };
}

async function recordCall() {
  const record = await getRateLimitRecord();
  record.calls.push({ timestamp: Date.now() });
  await saveRateLimitRecord(record);
}

// ============================================================
// FIRST PASS: Lightweight local extraction (no API call)
// ============================================================
export interface ParsedRecipe {
  name: string;
  description?: string;
  ingredients: {
    name: string;
    amount: number | null;
    unit: string | null;
    estimated_cost?: number | null;
  }[];
  steps: {
    order: number;
    title: string;
    description: string;
    duration_minutes?: number | null;
    temperature?: number | null;
    temperature_unit?: string | null;
    notes?: string | null;
  }[];
  estimated_duration_minutes?: number | null;
  estimated_cost?: number | null;
  yield_amount?: number | null;
  yield_unit?: string | null;
  tags?: string[];
}

function firstPassParse(rawText: string): Partial<ParsedRecipe> {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const result: Partial<ParsedRecipe> = { ingredients: [], steps: [] };

  // Try to extract a name from the first line
  if (lines.length > 0) {
    result.name = lines[0].replace(/^#*\s*/, '').replace(/[*_]/g, '').trim();
  }

  let mode: 'none' | 'ingredients' | 'steps' = 'none';
  let stepCounter = 0;

  const ingredientHeaderPattern = /^(ingredient|what you('| you )need|materials|shopping)/i;
  const stepHeaderPattern = /^(step|direction|instruction|method|procedure|how to|preparation)/i;

  for (const line of lines) {
    // Detect section headers
    if (ingredientHeaderPattern.test(line)) { mode = 'ingredients'; continue; }
    if (stepHeaderPattern.test(line)) { mode = 'steps'; continue; }

    // Auto-detect ingredient lines (e.g. "2 cups flour", "- 500g sugar")
    const ingredientMatch = line.match(/^[-•*]\s*(.+)|^(\d[\d.\s/]*)\s+(.+)/);
    if (mode === 'none' && ingredientMatch) { mode = 'ingredients'; }

    // Auto-detect numbered step lines (e.g. "1. Preheat oven")
    const stepMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (mode === 'none' && stepMatch) { mode = 'steps'; }

    if (mode === 'ingredients') {
      const cleaned = line.replace(/^[-•*]\s*/, '');
      const parsed = parseIngredientLine(cleaned);
      if (parsed) result.ingredients!.push(parsed);
    }

    if (mode === 'steps') {
      const stepText = line.replace(/^\d+[.)]\s*/, '').replace(/^[-•*]\s*/, '');
      if (stepText.length > 5) {
        stepCounter++;
        const duration = extractDuration(stepText);
        const temp = extractTemperature(stepText);
        result.steps!.push({
          order: stepCounter,
          title: stepText.slice(0, 60),
          description: stepText,
          duration_minutes: duration,
          temperature: temp?.value ?? null,
          temperature_unit: temp?.unit ?? null,
        });
      }
    }
  }

  // Extract yield (e.g. "Makes 12 cookies", "Serves 4", "Yield: 2 loaves")
  const yieldMatch = rawText.match(/(?:makes?|yields?|serves?|output)[:\s]*(\d+)\s*([a-z]+)?/i);
  if (yieldMatch) {
    result.yield_amount = parseFloat(yieldMatch[1]);
    result.yield_unit = yieldMatch[2] || 'servings';
  }

  // Sum up step durations for total estimate
  const totalDuration = result.steps!.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  if (totalDuration > 0) result.estimated_duration_minutes = totalDuration;

  return result;
}

function parseIngredientLine(line: string): ParsedRecipe['ingredients'][0] | null {
  if (line.length < 2) return null;

  // Match patterns like "2 cups flour", "500g sugar", "1/2 tsp vanilla extract"
  const match = line.match(/^([\d.\s/]*)\s*(cups?|tbsp|tsp|oz|g|grams?|kg|ml|l|liters?|lbs?|pinch|dash|handful|bunch|cloves?|sheets?|pieces?|whole|large|medium|small|pack|packages?|bags?|cans?|bottles?|boxes?|jars?)?\s*(.+)/i);
  if (match) {
    const rawAmount = match[1]?.trim();
    const unit = match[2]?.trim() || null;
    const name = match[3]?.trim();
    let amount: number | null = null;

    if (rawAmount) {
      // Handle fractions like "1/2" or "1 1/2"
      const fractionMatch = rawAmount.match(/(\d+)\s+(\d+)\/(\d+)/);
      const simpleFraction = rawAmount.match(/^(\d+)\/(\d+)$/);
      if (fractionMatch) {
        amount = parseInt(fractionMatch[1]) + parseInt(fractionMatch[2]) / parseInt(fractionMatch[3]);
      } else if (simpleFraction) {
        amount = parseInt(simpleFraction[1]) / parseInt(simpleFraction[2]);
      } else {
        amount = parseFloat(rawAmount) || null;
      }
    }

    if (name && name.length > 0) {
      return { name, amount, unit, estimated_cost: null };
    }
  }

  // Fallback: treat the whole line as an ingredient name
  return { name: line, amount: null, unit: null, estimated_cost: null };
}

function extractDuration(text: string): number | null {
  const match = text.match(/(\d+)\s*(min(?:ute)?s?|hrs?|hours?)/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('hr') || unit.startsWith('hour')) return value * 60;
  return value;
}

function extractTemperature(text: string): { value: number; unit: string } | null {
  const match = text.match(/(\d+)\s*°?\s*(f|c|fahrenheit|celsius)/i);
  if (!match) return null;
  return {
    value: parseInt(match[1]),
    unit: match[2].toLowerCase().startsWith('f') ? 'F' : 'C',
  };
}

// ============================================================
// SECOND PASS: Claude Haiku refinement + normalization
// ============================================================

const HAIKU_SYSTEM_PROMPT = `You are an expert recipe parser and bakery workflow normalizer. Your job is to take a partially parsed recipe and refine it into a clean, production-ready workflow.

RULES:
1. NORMALIZE ingredient names. Use consistent naming across all recipes:
   - "All purpose flour" → "All-Purpose Flour"
   - "all purp flour" → "All-Purpose Flour"
   - "AP flour" → "All-Purpose Flour"
   - "butter (unsalted)" → "Unsalted Butter"
   - "eggs" → "Large Eggs"
   - Always title case ingredient names.

2. NORMALIZE units. Pick one standard per ingredient type:
   - Dry goods: grams (g) preferred, cups as fallback
   - Liquids: milliliters (ml) preferred
   - Butter/fats: grams (g)
   - Eggs: count (no unit needed)
   - Spices: tsp/tbsp
   - If a unit is missing, infer the most logical one.

3. VALIDATE and FIX steps:
   - Each step must have a clear, actionable title (max 60 chars).
   - Each step must have a detailed description.
   - If a step is vague (e.g. "mix well"), expand it with specifics.
   - Merge steps that are redundant or too granular.
   - Ensure step order is logical for baking/cooking.
   - Add duration estimates where missing (use industry-standard baking times).
   - Add temperature where relevant (oven steps MUST have temperature).

4. FILL IN missing data:
   - If yield is missing, estimate based on recipe type and quantity of ingredients.
   - If total duration is missing, sum step durations + add 10% buffer for transitions.
   - If a recipe name is missing or generic, generate a descriptive name.
   - Add 2-5 relevant tags (e.g. "bread", "sourdough", "quick", "beginner-friendly").

5. OUTPUT FORMAT:
   Return ONLY a valid JSON object. No markdown, no backticks, no explanation.
   Use this exact structure:
   {
     "name": "string",
     "description": "string (1-2 sentences describing the recipe)",
     "ingredients": [
       { "name": "string", "amount": number|null, "unit": "string"|null, "estimated_cost": null }
     ],
     "steps": [
       { "order": number, "title": "string", "description": "string", "duration_minutes": number|null, "temperature": number|null, "temperature_unit": "string"|null, "notes": "string"|null }
     ],
     "estimated_duration_minutes": number|null,
     "estimated_cost": null,
     "yield_amount": number|null,
     "yield_unit": "string"|null,
     "tags": ["string"]
   }

6. CRITICAL: Do NOT invent ingredients or steps that were not in the original. You may EXPAND, CLARIFY, or NORMALIZE — never fabricate.`;

export async function parseRecipeWithAI(rawText: string): Promise<{ success: boolean; recipe?: ParsedRecipe; error?: string; rateLimitInfo?: { hourlyRemaining: number; dailyRemaining: number } }> {
  // Check rate limit FIRST
  const limitCheck = await checkRateLimit();
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: limitCheck.reason,
      rateLimitInfo: { hourlyRemaining: limitCheck.hourlyRemaining, dailyRemaining: limitCheck.dailyRemaining },
    };
  }

  // First pass: local extraction (free, instant)
  const firstPass = firstPassParse(rawText);

  try {
    // Second pass: Haiku refinement
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: HAIKU_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is a recipe that has been partially parsed. Refine, normalize, and fill in any gaps. Do NOT invent new ingredients or steps — only clarify and improve what exists.\n\n--- FIRST PASS RESULT ---\n${JSON.stringify(firstPass, null, 2)}\n\n--- ORIGINAL RAW TEXT (for reference) ---\n${rawText}\n\nReturn ONLY valid JSON.`,
        },
      ],
    });

    // Record the call AFTER successful API response
    await recordCall();

    const content = response.content[0];
    if (content.type !== 'text') {
      return { success: false, error: 'Unexpected response type from AI' };
    }

    // Parse the JSON response
    const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const refined: ParsedRecipe = JSON.parse(cleaned);

    return {
      success: true,
      recipe: refined,
      rateLimitInfo: { hourlyRemaining: limitCheck.hourlyRemaining - 1, dailyRemaining: limitCheck.dailyRemaining - 1 },
    };
  } catch (error: any) {
    console.error('AI recipe parsing error:', error);
    // If AI fails, fall back to first pass result gracefully
    if (firstPass.name && firstPass.ingredients && firstPass.ingredients.length > 0) {
      return {
        success: true,
        recipe: {
          name: firstPass.name || 'Untitled Recipe',
          ingredients: firstPass.ingredients || [],
          steps: firstPass.steps || [],
          estimated_duration_minutes: firstPass.estimated_duration_minutes || null,
          yield_amount: firstPass.yield_amount || null,
          yield_unit: firstPass.yield_unit || null,
        },
        rateLimitInfo: { hourlyRemaining: limitCheck.hourlyRemaining, dailyRemaining: limitCheck.dailyRemaining },
      };
    }
    return { success: false, error: 'AI parsing failed and first pass did not extract enough data. Please try again or format your recipe more clearly.' };
  }
}

// ============================================================
// CONVENIENCE: Parse raw text only (first pass, no AI cost)
// ============================================================
export function parseRecipeLocally(rawText: string): Partial<ParsedRecipe> {
  return firstPassParse(rawText);
}