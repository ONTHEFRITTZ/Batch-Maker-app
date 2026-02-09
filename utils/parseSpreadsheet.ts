import * as XLSX from "xlsx";
import { Step } from "../types";

export function parseSpreadsheetV2(uri: string): Step[] {
  const workbook = XLSX.read(uri, { type: "binary" });
  const steps: Step[] = [];

  console.log('🔍 ENHANCED PARSER V2 RUNNING');
  console.log('Found sheets:', workbook.SheetNames);
  
  workbook.SheetNames.forEach((sheetName) => {
    if (sheetName === "SOP_Template" || sheetName.toLowerCase().includes('template')) return;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);
    
    console.log(`\n📄 Sheet "${sheetName}" has ${rows.length} rows`);

    if (rows.length === 0) return;

    // ADAPTIVE COLUMN DETECTION
    const headers = Object.keys(rows[0]);
    console.log('Detected columns:', headers);

    // Detect column names flexibly
    const detectColumn = (patterns: string[]): string | null => {
      for (const header of headers) {
        const headerLower = header.toLowerCase();
        if (patterns.some(p => headerLower.includes(p))) {
          return header;
        }
      }
      return null;
    };

    const stepNumCol = detectColumn(['step', '#', 'number', 'num', 'no']);
    const instructionCol = detectColumn(['instruction', 'direction', 'step', 'description', 'task', 'action']);
    const ingredientCol = detectColumn(['ingredient', 'requirement', 'component', 'item', 'material', 'checklist']);
    const amountCol = detectColumn(['amount', 'quantity', 'weight', 'gram', 'measure']);
    const timeCol = detectColumn(['time', 'duration', 'timer', 'minute', 'hour']);
    const tempCol = detectColumn(['temp', 'temperature', 'heat', 'degree']);
    const visualCol = detectColumn(['visual', 'cue', 'note', 'tip', 'hint']);
    const confirmCol = detectColumn(['confirm', 'check', 'verify', 'validation']);

    console.log('Column mapping:', {
      stepNum: stepNumCol,
      instruction: instructionCol,
      ingredient: ingredientCol,
      amount: amountCol,
      time: timeCol,
      temp: tempCol
    });

    // Group rows by step number
    const stepGroups = new Map<number, any[]>();
    
    rows.forEach((row, index) => {
      // Try to find step number
      let stepNum: number | null = null;

      if (stepNumCol && row[stepNumCol]) {
        stepNum = typeof row[stepNumCol] === 'number' ? row[stepNumCol] : parseInt(row[stepNumCol]);
      }

      // If no explicit step column, try to infer from row index or instruction
      if (!stepNum || isNaN(stepNum)) {
        if (instructionCol && row[instructionCol]) {
          const instText = String(row[instructionCol]);
          const match = instText.match(/(?:step\s+)?(\d+)/i);
          if (match) {
            stepNum = parseInt(match[1]);
          }
        }
      }

      // Fallback: treat as sequential
      if (!stepNum || isNaN(stepNum)) {
        // Check if this row has meaningful content
        const hasContent = instructionCol && row[instructionCol] && String(row[instructionCol]).trim().length > 5;
        if (hasContent) {
          stepNum = stepGroups.size + 1;
        }
      }

      if (stepNum && !isNaN(stepNum)) {
        if (!stepGroups.has(stepNum)) {
          stepGroups.set(stepNum, []);
        }
        stepGroups.get(stepNum)!.push(row);
      } else if (stepGroups.size > 0) {
        // Continuation row - add to last step
        const lastStepNum = Array.from(stepGroups.keys()).pop()!;
        stepGroups.get(lastStepNum)!.push(row);
      }
    });
    
    console.log(`✅ Grouped into ${stepGroups.size} steps`);
    stepGroups.forEach((rows, num) => {
      console.log(`   Step ${num}: ${rows.length} row(s)`);
    });

    // Convert each step group into a Step
    stepGroups.forEach((stepRows, stepNum) => {
      const firstRow = stepRows[0];
      
      // Build checklist from all rows
      const ingredients: string[] = [];
      
      stepRows.forEach((row) => {
        let ingredient = '';

        if (ingredientCol && row[ingredientCol]) {
          ingredient = String(row[ingredientCol]).trim();
        }

        if (!ingredient) {
          // Try to find any column with text that looks like an ingredient
          for (const header of headers) {
            const value = row[header];
            if (value && typeof value === 'string' && value.length > 2 && value.length < 100) {
              // Skip if it's a number, step instruction, or matches other known columns
              if (!/^\d+$/.test(value) && header !== instructionCol) {
                ingredient = value.trim();
                break;
              }
            }
          }
        }

        if (!ingredient) return;

        // Add amount if available
        let amount = '';
        if (amountCol && row[amountCol]) {
          amount = String(row[amountCol]).trim();
        }

        // Check visual cues for sub-recipe references
        const visualCue = visualCol ? String(row[visualCol] || '') : '';
        if (visualCue.includes('*See') && visualCue.includes('recipe')) {
          ingredients.push(visualCue);
        } else if (amount) {
          // Try to detect unit from amount
          const hasUnit = /g|kg|ml|l|oz|lb|cup|tbsp|tsp/i.test(amount);
          if (hasUnit) {
            ingredients.push(`${ingredient}: ${amount}`);
          } else {
            ingredients.push(`${ingredient}: ${amount}g`);
          }
        } else {
          ingredients.push(ingredient);
        }
      });

      console.log(`   📋 Step ${stepNum} has ${ingredients.length} checklist items`);

      // Build description
      let description = '';
      
      if (instructionCol && firstRow[instructionCol]) {
        description = String(firstRow[instructionCol]).trim();
      }

      // Add target temp
      if (tempCol && firstRow[tempCol]) {
        const temp = String(firstRow[tempCol]).trim();
        if (temp && temp !== '0') {
          description += `\n\nTarget temp: ${temp}${temp.match(/[°FCfc]/) ? '' : '°C'}`;
        }
      }
      
      // Add visual cues (non-recipe ones)
      if (visualCol) {
        const visualCues = stepRows
          .map(r => r[visualCol])
          .filter(v => v && !String(v).includes('*See'))
          .map(v => String(v).trim())
          .filter(Boolean)
          .join('\n');
        
        if (visualCues) {
          description += `\n\n${visualCues}`;
        }
      }

      // Add checklist to description
      if (ingredients.length > 0) {
        const checklistText = ingredients
          .map(item => `☐ ${item}`)
          .join('\n');
        
        if (description) {
          description += '\n\n';
        }
        description += '📋 Checklist:\n' + checklistText;
      }

      // Timer - handle multiple formats
      let timerMinutes: number | undefined;
      if (timeCol && firstRow[timeCol]) {
        const timeValue = firstRow[timeCol];
        
        if (typeof timeValue === 'number') {
          timerMinutes = timeValue;
        } else {
          const timeStr = String(timeValue).trim();
          // Parse various time formats
          const match = timeStr.match(/(\d+)\s*(min|minute|hr|hour|h|m)?/i);
          if (match) {
            const num = parseInt(match[1]);
            const unit = match[2]?.toLowerCase();
            
            if (unit && (unit.startsWith('h') || unit === 'hr')) {
              timerMinutes = num * 60;
            } else {
              timerMinutes = num;
            }
          }
        }
      }

      // Check confirmation required
      let confirmationRequired = false;
      if (confirmCol && firstRow[confirmCol]) {
        const confirm = String(firstRow[confirmCol]).toLowerCase();
        confirmationRequired = confirm === 'y' || confirm === 'yes' || confirm === 'true' || confirm === '1';
      }

      // Generate title
      let title = description.split('\n')[0];
      if (!title || title.length > 100) {
        title = `Step ${stepNum}`;
      }

      steps.push({
        id: `${sheetName}-${stepNum}`,
        recipeName: sheetName,
        componentType: firstRow['Stage'] || firstRow['Type'] || '',
        stage: firstRow['Stage'] || firstRow['Phase'] || '',
        order: stepNum,
        title,
        instructions: description.trim(),
        ingredients: ingredients,
        targetTemp: tempCol && firstRow[tempCol] ? String(firstRow[tempCol]) : undefined,
        targetWeight: undefined,
        suggestedTime: timerMinutes,
        timerSuggested: timerMinutes !== undefined,
        visualCues: visualCol && firstRow[visualCol] ? String(firstRow[visualCol]) : undefined,
        confirmationRequired,
      });
    });
  });

  console.log(`\n🎯 Total steps created: ${steps.length}`);
  return steps.sort((a, b) => a.order - b.order);
}