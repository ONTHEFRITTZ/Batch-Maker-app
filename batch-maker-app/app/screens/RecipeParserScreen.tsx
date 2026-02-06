import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { addWorkflow, Workflow } from '../../services/database';

// Fraction conversion table
const FRACTIONS: { [key: string]: string } = {
  '½': '0.5', '⅓': '0.33', '⅔': '0.67', '¼': '0.25', '¾': '0.75',
  '⅕': '0.2', '⅖': '0.4', '⅗': '0.6', '⅘': '0.8', '⅙': '0.17',
  '⅐': '0.14', '⅛': '0.125', '⅑': '0.11', '⅒': '0.1',
  '1/2': '0.5', '1/3': '0.33', '2/3': '0.67', '1/4': '0.25', '3/4': '0.75',
  '1/8': '0.125', '3/8': '0.375', '5/8': '0.625', '7/8': '0.875',
};

// Comprehensive units list
const INGREDIENT_UNITS = [
  // Weight
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces',
  'lb', 'lbs', 'pound', 'pounds', 'mg', 'milligram', 'milligrams',
  // Volume
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters',
  'cup', 'cups', 'c', 'tbsp', 'tablespoon', 'tablespoons', 'tbs', 'T',
  'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'fluid ounce', 'fluid ounces',
  'pint', 'pints', 'pt', 'quart', 'quarts', 'qt', 'gallon', 'gallons', 'gal',
  // Count
  'piece', 'pieces', 'whole', 'clove', 'cloves', 'pinch', 'dash', 'handful',
  'slice', 'slices', 'can', 'cans', 'package', 'packages', 'pkg', 'bunch', 'bunches',
  'stick', 'sticks', 'sheet', 'sheets', 'strip', 'strips', 'sprig', 'sprigs',
  'leaf', 'leaves', 'head', 'heads', 'bulb', 'bulbs', 'stalk', 'stalks',
  // Other
  'to taste', 'as needed', 'optional',
];

// Common ingredient keywords
const INGREDIENT_KEYWORDS = [
  'flour', 'water', 'salt', 'sugar', 'yeast', 'butter', 'milk', 'egg', 'eggs',
  'oil', 'cream', 'vanilla', 'chocolate', 'cocoa', 'baking powder', 'baking soda',
  'honey', 'syrup', 'garlic', 'onion', 'tomato', 'pepper', 'cheese', 'chicken',
  'beef', 'pork', 'fish', 'rice', 'pasta', 'bread', 'sauce', 'stock', 'broth',
  'wine', 'vinegar', 'lemon', 'lime', 'herbs', 'spices', 'cinnamon', 'nutmeg',
  'ginger', 'paprika', 'cumin', 'oregano', 'basil', 'thyme', 'rosemary', 'parsley',
  'cilantro', 'mint', 'carrot', 'celery', 'potato', 'mushroom', 'spinach', 'kale',
  'lettuce', 'cabbage', 'broccoli', 'cauliflower', 'bean', 'beans', 'lentil',
  'chickpea', 'pea', 'corn', 'zucchini', 'eggplant', 'cucumber', 'avocado',
  'apple', 'banana', 'orange', 'strawberry', 'blueberry', 'raspberry', 'mango',
  'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'oat', 'oats', 'quinoa',
];

function normalizeFractions(text: string): string {
  let normalized = text;
  Object.keys(FRACTIONS).forEach(frac => {
    normalized = normalized.replace(new RegExp(frac, 'g'), FRACTIONS[frac]);
  });
  return normalized;
}

function detectIngredients(text: string): string[] {
  const lines = text.split('\n');
  const ingredients: string[] = [];
  
  let inIngredientsSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Detect ingredients section headers
    if (/^(ingredients?|what you.?ll? need|you.?ll? need|shopping list|for the|grocery list)/i.test(trimmed)) {
      inIngredientsSection = true;
      continue;
    }
    
    // Stop at instructions/directions section
    if (/^(instructions?|directions?|method|steps?|preparation|how to|procedure)/i.test(trimmed)) {
      inIngredientsSection = false;
      if (ingredients.length > 0) break; // We already found ingredients
    }
    
    // Check if line looks like an ingredient
    const normalized = normalizeFractions(trimmed);
    
    // Has a number (including fractions)
    const hasNumber = /\d/.test(normalized);
    
    // Has a unit
    const hasUnit = INGREDIENT_UNITS.some(unit => {
      const regex = new RegExp(`\\b${unit}s?\\b`, 'i');
      return regex.test(normalized);
    });
    
    // Has an ingredient keyword
    const hasIngredient = INGREDIENT_KEYWORDS.some(keyword =>
      normalized.toLowerCase().includes(keyword)
    );
    
    // Has bullet/dash/number prefix
    const hasBullet = /^[-•*▪▫◦‣⁃∙●○◘◙►▻✓✔⬩⬧⬨⬩◆◇■□▪▫]/.test(trimmed) || 
                      /^\d+[\.)]\s/.test(trimmed);
    
    // Detect if it's likely an ingredient
    const isLikelyIngredient = 
      inIngredientsSection ||
      (hasBullet && (hasNumber || hasUnit || hasIngredient)) ||
      (hasNumber && hasUnit) ||
      (hasNumber && hasIngredient) ||
      (hasUnit && hasIngredient);
    
    if (isLikelyIngredient) {
      // Clean up the line
      let cleaned = trimmed
        .replace(/^[-•*▪▫◦‣⁃∙●○◘◙►▻✓✔⬩⬧⬨⬩◆◇■□▪▫]\s*/, '') // Remove bullets
        .replace(/^\d+[\.)]\s*/, '') // Remove numbered list markers
        .trim();
      
      if (cleaned && !ingredients.includes(cleaned)) {
        ingredients.push(cleaned);
      }
    }
  }
  
  return ingredients;
}

export default function RecipeParserScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [workflowName, setWorkflowName] = useState('');
  const [recipeText, setRecipeText] = useState('');

  const parseRecipe = () => {
    if (!workflowName.trim()) {
      Alert.alert('Error', 'Please enter a workflow name');
      return;
    }

    if (!recipeText.trim()) {
      Alert.alert('Error', 'Please enter recipe text');
      return;
    }

    try {
      const normalizedText = normalizeFractions(recipeText);
      const lines = normalizedText.split('\n').map(line => line.trim()).filter(Boolean);
      
      if (lines.length === 0) {
        Alert.alert('Error', 'Could not parse recipe');
        return;
      }

      const steps: Array<{
        title: string;
        description: string;
        timerMinutes?: number;
        checklistItems: string[];
      }> = [];

      let currentStep: {
        title: string;
        description: string;
        timerMinutes?: number;
        checklistItems: string[];
      } | null = null;

      let inInstructionsSection = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect instructions section
        if (/^(instructions?|directions?|method|steps?|preparation|how to|procedure)/i.test(line)) {
          inInstructionsSection = true;
          continue;
        }

        if (!inInstructionsSection) continue;

        // Check if it's a step header
        const isStepHeader = 
          /^(step\s+)?\d+[\.):]/.test(line.toLowerCase()) ||
          /^(step|stage|phase)\s+\d+/i.test(line) ||
          (line.length < 100 && line.endsWith(':')) ||
          /^(mix|stir|combine|add|pour|heat|cook|bake|preheat|prepare|place|remove|set|let|allow|cover|uncover|transfer|serve)/i.test(line);

        if (isStepHeader && currentStep) {
          // Save previous step
          steps.push(currentStep);
          currentStep = {
            title: line.replace(/^(step\s+)?\d+[\.):]?\s*/i, '').replace(/:$/, '').trim(),
            description: '',
            checklistItems: [],
          };
        } else if (isStepHeader) {
          currentStep = {
            title: line.replace(/^(step\s+)?\d+[\.):]?\s*/i, '').replace(/:$/, '').trim(),
            description: '',
            checklistItems: [],
          };
        } else if (currentStep) {
          // Check for timer
          const timerMatch = line.match(/(\d+)\s*-?\s*(\d+)?\s*(minute|minutes|min|mins|hour|hours|hr|hrs)/i);
          if (timerMatch && !currentStep.timerMinutes) {
            const num1 = parseInt(timerMatch[1]);
            const num2 = timerMatch[2] ? parseInt(timerMatch[2]) : num1;
            const avgTime = Math.round((num1 + num2) / 2);
            const unit = timerMatch[3].toLowerCase();
            
            if (unit.startsWith('h')) {
              currentStep.timerMinutes = avgTime * 60;
            } else {
              currentStep.timerMinutes = avgTime;
            }
          }

          // Add to description
          if (currentStep.description) {
            currentStep.description += '\n' + line;
          } else {
            currentStep.description = line;
          }
        }
      }

      // Save last step
      if (currentStep) {
        steps.push(currentStep);
      }

      // If no structured steps found, create steps from paragraphs
      if (steps.length === 0) {
        const paragraphs = recipeText
          .split(/\n\n+/)
          .map(p => p.trim())
          .filter(p => p.length > 50 && !/^(ingredients?|what you)/i.test(p));

        paragraphs.forEach((para, idx) => {
          const firstLine = para.split('\n')[0];
          steps.push({
            title: firstLine.length < 60 ? firstLine : `Step ${idx + 1}`,
            description: para,
            checklistItems: [],
          });
        });
      }

      if (steps.length === 0) {
        Alert.alert('Error', 'Could not identify any steps');
        return;
      }

      // Extract ingredients for the whole recipe
      const allIngredients = detectIngredients(recipeText);

      // Assign ingredients to steps intelligently
      steps.forEach(step => {
        const stepText = (step.title + ' ' + step.description).toLowerCase();
        
        allIngredients.forEach(ing => {
          const ingWords = ing.toLowerCase().split(/\s+/);
          const mainIngredient = ingWords[ingWords.length - 1]; // Last word is usually key
          
          // Check if this ingredient is mentioned in this step
          if (stepText.includes(mainIngredient)) {
            if (!step.checklistItems.includes(ing)) {
              step.checklistItems.push(ing);
            }
          }
        });
      });

      // If no ingredients matched to first step, add them all there
      if (steps[0] && steps[0].checklistItems.length === 0 && allIngredients.length > 0) {
        steps[0].checklistItems = allIngredients;
      }

      // Create workflow
      const workflowId = workflowName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
      
      const workflow: Workflow = {
        id: workflowId,
        name: workflowName,
        steps: steps.map((step, index) => {
          let description = step.description;
          
          // Add checklist if ingredients detected
          if (step.checklistItems.length > 0) {
            const checklistText = step.checklistItems
              .map(item => `☐ ${item}`)
              .join('\n');
            
            if (description) {
              description += '\n\n📋 Checklist:\n' + checklistText;
            } else {
              description = '📋 Checklist:\n' + checklistText;
            }
          }

          return {
            id: `${workflowId}_step_${index + 1}`,
            title: step.title || `Step ${index + 1}`,
            description,
            timerMinutes: step.timerMinutes,
            completed: false,
          };
        }),
      };

      addWorkflow(workflow);

      Alert.alert(
        'Success',
        `Created workflow "${workflowName}" with ${steps.length} steps and ${allIngredients.length} ingredients`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          }
        ]
      );
    } catch (error) {
      console.error('Error parsing recipe:', error);
      Alert.alert('Error', 'Failed to parse recipe');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Import Recipe from Text</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Paste your recipe and we'll automatically detect ingredients and create checklists
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Workflow Name *</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border
            }]}
            value={workflowName}
            onChangeText={setWorkflowName}
            placeholder="e.g., Sourdough Bread"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Recipe Text *</Text>
          <TextInput
            style={[styles.textArea, {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border
            }]}
            value={recipeText}
            onChangeText={setRecipeText}
            placeholder="Paste your recipe here...&#10;&#10;Ingredients:&#10;• 500g flour&#10;• 350ml water&#10;• 10g salt&#10;&#10;Instructions:&#10;1. Mix flour and water&#10;2. Let rest 30 minutes&#10;3. Add salt and knead"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={15}
          />
        </View>

        <View style={[styles.infoBox, {
          backgroundColor: colors.primary + '15',
          borderColor: colors.primary
        }]}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>✨ Smart Detection</Text>
          <Text style={[styles.infoText, { color: colors.text }]}>
            • Recognizes fractions (½, ¼, ⅓, 1/2, etc.){'\n'}
            • Detects ingredients with any format{'\n'}
            • Extracts timers (30 minutes, 1-2 hours){'\n'}
            • Matches ingredients to steps{'\n'}
            • Handles numbered or bullet lists{'\n'}
            • Works with many recipe formats
          </Text>
        </View>

        <View style={[styles.exampleBox, {
          backgroundColor: colors.surfaceVariant,
          borderColor: colors.border
        }]}>
          <Text style={[styles.exampleTitle, { color: colors.text }]}>Supported Formats:</Text>
          <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
            ✓ Numbered steps (1. 2. 3.){'\n'}
            ✓ Bullet points (• - *){'\n'}
            ✓ Step headers (Step 1:){'\n'}
            ✓ Action verbs (Mix, Bake, Add){'\n'}
            ✓ Fractions and decimals{'\n'}
            ✓ Any measurement units{'\n'}
            ✓ Multiple ingredient sections
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, {
        backgroundColor: colors.surface,
        borderTopColor: colors.border
      }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.surfaceVariant }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={parseRecipe}
        >
          <Text style={styles.createButtonText}>Create Workflow</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32, lineHeight: 22 },
  section: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, minHeight: 300, textAlignVertical: 'top' },
  infoBox: { borderWidth: 2, borderRadius: 12, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  infoText: { fontSize: 14, lineHeight: 22 },
  exampleBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  exampleTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  exampleText: { fontSize: 13, lineHeight: 20 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  createButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  createButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});