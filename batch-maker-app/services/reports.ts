import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../app/lib/supabase';

const REPORTS_KEY = '@reports';

export interface EnvironmentalReport {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  ambientTemp?: number;
  humidity?: number;
  notes?: string;
  createdBy: string;
  userId?: string; // Added for Supabase sync
}

export interface IngredientUsage {
  name: string;
  amount: number;
  unit: string;
  cost?: number;
}

export interface BatchCompletionReport {
  id: string;
  batchId: string;
  batchName: string;
  workflowId: string;
  workflowName: string;
  timestamp: number;
  date: string;
  time: string;
  completedBy: string;
  batchSizeMultiplier: number;
  environmentalReportId?: string;
  actualDuration?: number;
  notes?: string;
  photos?: string[];
  stepNotes?: { [stepId: string]: string };
  temperatureLog?: { stepId: string; temp: number; timestamp: number }[];
  ingredientsUsed?: IngredientUsage[];
  totalCost?: number;
  yieldAmount?: number;
  yieldUnit?: string;
  userId?: string; // Added for Supabase sync
}

export interface DailyReport {
  id: string;
  date: string;
  timestamp: number;
  totalBatches: number;
  batchesByWorkflow: { [workflowId: string]: number };
  averageDuration: number;
  totalIngredientCost?: number;
  totalYield?: { [unit: string]: number };
  environmentalReports: EnvironmentalReport[];
  batchCompletions: BatchCompletionReport[];
  userId?: string; // Added for Supabase sync
}

interface ReportsData {
  environmental: EnvironmentalReport[];
  batchCompletions: BatchCompletionReport[];
  daily: DailyReport[];
}

let reportsData: ReportsData = {
  environmental: [],
  batchCompletions: [],
  daily: [],
};

// Get current user ID
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function initializeReports(): Promise<void> {
  try {
    // First load from local storage
    const stored = await AsyncStorage.getItem(REPORTS_KEY);
    if (stored) {
      reportsData = JSON.parse(stored);
      console.log(`Loaded reports from local: ${reportsData.environmental.length} environmental, ${reportsData.batchCompletions.length} batch, ${reportsData.daily.length} daily`);
    }

    // Then sync with Supabase
    await syncFromSupabase();
  } catch (error) {
    console.error('Error loading reports:', error);
  }
}

async function saveReports(): Promise<void> {
  try {
    // Save locally
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reportsData));
  } catch (error) {
    console.error('Error saving reports locally:', error);
  }
}

// Sync reports from Supabase
async function syncFromSupabase(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('⚠️ No user logged in, skipping Supabase sync');
      return;
    }

    console.log('🔄 Syncing reports from Supabase...');

    // Fetch batch completion reports
    const { data: batchReports, error: batchError } = await supabase
      .from('batch_completion_reports')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (batchError) {
      console.error('Error fetching batch reports:', batchError);
    } else if (batchReports) {
      // Merge with local data (keep local if not in Supabase)
      const supabaseIds = new Set(batchReports.map(r => r.id));
      const localOnly = reportsData.batchCompletions.filter(r => !supabaseIds.has(r.id));
      
      reportsData.batchCompletions = [
        ...batchReports.map(r => ({
          ...r,
          userId: r.user_id,
          stepNotes: r.step_notes || {},
          temperatureLog: r.temperature_log || [],
          ingredientsUsed: r.ingredients_used || [],
        })),
        ...localOnly
      ];
      console.log(`✅ Synced ${batchReports.length} batch reports from Supabase`);
    }

    // Fetch environmental reports
    const { data: envReports, error: envError } = await supabase
      .from('environmental_reports')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (envError) {
      console.error('Error fetching environmental reports:', envError);
    } else if (envReports) {
      const supabaseIds = new Set(envReports.map(r => r.id));
      const localOnly = reportsData.environmental.filter(r => !supabaseIds.has(r.id));
      
      reportsData.environmental = [
        ...envReports.map(r => ({
          ...r,
          userId: r.user_id,
          ambientTemp: r.ambient_temp,
          createdBy: r.created_by,
        })),
        ...localOnly
      ];
      console.log(`✅ Synced ${envReports.length} environmental reports from Supabase`);
    }

    await saveReports();
  } catch (error) {
    console.error('Error syncing from Supabase:', error);
  }
}

// Sync a report to Supabase
async function syncToSupabase(report: any, table: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('⚠️ No user logged in, saving locally only');
      return;
    }

    let data: any = { ...report, user_id: userId };

    // Convert field names to snake_case for Supabase
    if (table === 'batch_completion_reports') {
      data = {
        id: report.id,
        user_id: userId,
        batch_id: report.batchId,
        batch_name: report.batchName,
        workflow_id: report.workflowId,
        workflow_name: report.workflowName,
        timestamp: report.timestamp,
        date: report.date,
        time: report.time,
        completed_by: report.completedBy,
        batch_size_multiplier: report.batchSizeMultiplier,
        environmental_report_id: report.environmentalReportId,
        actual_duration: report.actualDuration,
        notes: report.notes,
        photos: report.photos,
        step_notes: report.stepNotes,
        temperature_log: report.temperatureLog,
        ingredients_used: report.ingredientsUsed,
        total_cost: report.totalCost,
        yield_amount: report.yieldAmount,
        yield_unit: report.yieldUnit,
      };
    } else if (table === 'environmental_reports') {
      data = {
        id: report.id,
        user_id: userId,
        timestamp: report.timestamp,
        date: report.date,
        time: report.time,
        ambient_temp: report.ambientTemp,
        humidity: report.humidity,
        notes: report.notes,
        created_by: report.createdBy,
      };
    }

    const { error } = await supabase
      .from(table)
      .upsert(data, { onConflict: 'id' });

    if (error) {
      console.error(`Error syncing to ${table}:`, error);
    } else {
      console.log(`✅ Synced report to ${table}`);
    }
  } catch (error) {
    console.error('Error syncing to Supabase:', error);
  }
}

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getTimeString(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// ============================================
// ENVIRONMENTAL REPORTS
// ============================================

export async function createEnvironmentalReport(
  createdBy: string,
  ambientTemp?: number,
  humidity?: number,
  notes?: string
): Promise<EnvironmentalReport> {
  const timestamp = Date.now();
  const userId = await getCurrentUserId();
  
  const report: EnvironmentalReport = {
    id: `env_${timestamp}`,
    timestamp,
    date: getTodayDateString(),
    time: getTimeString(timestamp),
    ambientTemp,
    humidity,
    notes,
    createdBy,
    userId: userId || undefined,
  };

  reportsData.environmental.push(report);
  await saveReports();
  await syncToSupabase(report, 'environmental_reports');
  
  return report;
}

export function getEnvironmentalReports(date?: string): EnvironmentalReport[] {
  if (date) {
    return reportsData.environmental.filter(r => r.date === date);
  }
  return [...reportsData.environmental];
}

export function getTodaysEnvironmentalReports(): EnvironmentalReport[] {
  return getEnvironmentalReports(getTodayDateString());
}

export async function deleteEnvironmentalReport(id: string): Promise<void> {
  reportsData.environmental = reportsData.environmental.filter(r => r.id !== id);
  await saveReports();
  
  // Delete from Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    await supabase
      .from('environmental_reports')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
  }
}

// ============================================
// BATCH COMPLETION REPORTS
// ============================================

export async function createBatchCompletionReport(
  batchId: string,
  batchName: string,
  workflowId: string,
  workflowName: string,
  completedBy: string,
  batchSizeMultiplier: number,
  actualDuration?: number,
  notes?: string,
  stepNotes?: { [stepId: string]: string },
  temperatureLog?: { stepId: string; temp: number; timestamp: number }[],
  ingredientsUsed?: IngredientUsage[],
  yieldAmount?: number,
  yieldUnit?: string
): Promise<BatchCompletionReport> {
  const timestamp = Date.now();
  const todayDate = getTodayDateString();
  const userId = await getCurrentUserId();

  const todaysEnvReports = getTodaysEnvironmentalReports();
  const environmentalReportId = todaysEnvReports.length > 0 
    ? todaysEnvReports[todaysEnvReports.length - 1].id 
    : undefined;

  const totalCost = ingredientsUsed?.reduce((sum, ing) => sum + (ing.cost || 0), 0);

  const report: BatchCompletionReport = {
    id: `batch_${timestamp}`,
    batchId,
    batchName,
    workflowId,
    workflowName,
    timestamp,
    date: todayDate,
    time: getTimeString(timestamp),
    completedBy,
    batchSizeMultiplier,
    environmentalReportId,
    actualDuration,
    notes,
    stepNotes,
    temperatureLog,
    ingredientsUsed,
    totalCost,
    yieldAmount,
    yieldUnit,
    userId: userId || undefined,
  };

  reportsData.batchCompletions.push(report);
  await saveReports();
  await syncToSupabase(report, 'batch_completion_reports');

  return report;
}

export function getBatchCompletionReports(date?: string): BatchCompletionReport[] {
  if (date) {
    return reportsData.batchCompletions.filter(r => r.date === date);
  }
  return [...reportsData.batchCompletions];
}

export function getTodaysBatchCompletions(): BatchCompletionReport[] {
  return getBatchCompletionReports(getTodayDateString());
}

export function searchBatchReports(query: string): BatchCompletionReport[] {
  const lowerQuery = query.toLowerCase();
  return reportsData.batchCompletions.filter(r => 
    r.batchName.toLowerCase().includes(lowerQuery) ||
    r.workflowName.toLowerCase().includes(lowerQuery) ||
    r.completedBy.toLowerCase().includes(lowerQuery) ||
    r.notes?.toLowerCase().includes(lowerQuery)
  );
}

export async function deleteBatchCompletionReport(id: string): Promise<void> {
  reportsData.batchCompletions = reportsData.batchCompletions.filter(r => r.id !== id);
  await saveReports();
  
  // Delete from Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    await supabase
      .from('batch_completion_reports')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
  }
}

// ============================================
// DAILY REPORTS
// ============================================

export async function generateDailyReport(date?: string): Promise<DailyReport> {
  const targetDate = date || getTodayDateString();
  const timestamp = Date.now();

  const envReports = getEnvironmentalReports(targetDate);
  const batchReports = getBatchCompletionReports(targetDate);

  const totalBatches = batchReports.length;
  const batchesByWorkflow: { [workflowId: string]: number } = {};
  let totalDuration = 0;
  let countWithDuration = 0;
  let totalIngredientCost = 0;
  const totalYield: { [unit: string]: number } = {};

  batchReports.forEach(report => {
    if (!batchesByWorkflow[report.workflowId]) {
      batchesByWorkflow[report.workflowId] = 0;
    }
    batchesByWorkflow[report.workflowId]++;

    if (report.actualDuration) {
      totalDuration += report.actualDuration;
      countWithDuration++;
    }

    if (report.totalCost) {
      totalIngredientCost += report.totalCost;
    }

    if (report.yieldAmount && report.yieldUnit) {
      if (!totalYield[report.yieldUnit]) {
        totalYield[report.yieldUnit] = 0;
      }
      totalYield[report.yieldUnit] += report.yieldAmount;
    }
  });

  const averageDuration = countWithDuration > 0 
    ? Math.round(totalDuration / countWithDuration) 
    : 0;

  const report: DailyReport = {
    id: `daily_${targetDate}`,
    date: targetDate,
    timestamp,
    totalBatches,
    batchesByWorkflow,
    averageDuration,
    totalIngredientCost: totalIngredientCost > 0 ? totalIngredientCost : undefined,
    totalYield: Object.keys(totalYield).length > 0 ? totalYield : undefined,
    environmentalReports: envReports,
    batchCompletions: batchReports,
  };

  reportsData.daily = reportsData.daily.filter(r => r.date !== targetDate);
  reportsData.daily.push(report);
  await saveReports();

  return report;
}

export function getDailyReports(): DailyReport[] {
  return [...reportsData.daily].sort((a, b) => b.timestamp - a.timestamp);
}

export function getDailyReport(date: string): DailyReport | undefined {
  return reportsData.daily.find(r => r.date === date);
}

export async function deleteDailyReport(id: string): Promise<void> {
  reportsData.daily = reportsData.daily.filter(r => r.id !== id);
  await saveReports();
}

// ============================================
// MANUAL SYNC
// ============================================

export async function forceSyncToSupabase(): Promise<void> {
  console.log('🔄 Force syncing all reports to Supabase...');
  
  for (const report of reportsData.batchCompletions) {
    await syncToSupabase(report, 'batch_completion_reports');
  }
  
  for (const report of reportsData.environmental) {
    await syncToSupabase(report, 'environmental_reports');
  }
  
  console.log('✅ Force sync complete');
}

export async function forceSyncFromSupabase(): Promise<void> {
  await syncFromSupabase();
}

// ============================================
// ANALYTICS
// ============================================

export function getWorkflowStats(workflowId: string): {
  totalBatches: number;
  averageDuration: number;
  lastCompleted?: number;
  totalCost?: number;
  totalYield?: { [unit: string]: number };
} {
  const batches = reportsData.batchCompletions.filter(r => r.workflowId === workflowId);
  
  let totalDuration = 0;
  let countWithDuration = 0;
  let lastCompleted: number | undefined;
  let totalCost = 0;
  const totalYield: { [unit: string]: number } = {};

  batches.forEach(batch => {
    if (batch.actualDuration) {
      totalDuration += batch.actualDuration;
      countWithDuration++;
    }
    if (!lastCompleted || batch.timestamp > lastCompleted) {
      lastCompleted = batch.timestamp;
    }
    if (batch.totalCost) {
      totalCost += batch.totalCost;
    }
    if (batch.yieldAmount && batch.yieldUnit) {
      if (!totalYield[batch.yieldUnit]) {
        totalYield[batch.yieldUnit] = 0;
      }
      totalYield[batch.yieldUnit] += batch.yieldAmount;
    }
  });

  return {
    totalBatches: batches.length,
    averageDuration: countWithDuration > 0 ? Math.round(totalDuration / countWithDuration) : 0,
    lastCompleted,
    totalCost: totalCost > 0 ? totalCost : undefined,
    totalYield: Object.keys(totalYield).length > 0 ? totalYield : undefined,
  };
}

export function getDateRangeReports(startDate: string, endDate: string): {
  environmental: EnvironmentalReport[];
  batchCompletions: BatchCompletionReport[];
} {
  return {
    environmental: reportsData.environmental.filter(r => r.date >= startDate && r.date <= endDate),
    batchCompletions: reportsData.batchCompletions.filter(r => r.date >= startDate && r.date <= endDate),
  };
}

// ============================================
// EXPORT - JSON
// ============================================

export function exportReportsAsJSON(): string {
  return JSON.stringify(reportsData, null, 2);
}

// ============================================
// EXPORT - CSV (Excel-compatible)
// ============================================

export function generateBatchReportsCSV(): string {
  let csv = 'Date,Time,Batch Name,Workflow,Station,Size,Duration (min),Cost,Yield,Notes\n';
  
  reportsData.batchCompletions.forEach(report => {
    const cost = report.totalCost ? `${report.totalCost.toFixed(2)}` : '';
    const yieldStr = report.yieldAmount && report.yieldUnit 
      ? `${report.yieldAmount}${report.yieldUnit}` 
      : '';
    const notes = (report.notes || '').replace(/,/g, ';').replace(/\n/g, ' ');
    
    csv += `${report.date},${report.time},"${report.batchName}","${report.workflowName}",${report.completedBy},${report.batchSizeMultiplier}x,${report.actualDuration || ''},${cost},${yieldStr},"${notes}"\n`;
  });
  
  return csv;
}

export function generateEnvironmentalReportsCSV(): string {
  let csv = 'Date,Time,Station,Temperature (°C),Humidity (%),Notes\n';
  
  reportsData.environmental.forEach(report => {
    const notes = (report.notes || '').replace(/,/g, ';').replace(/\n/g, ' ');
    csv += `${report.date},${report.time},${report.createdBy},${report.ambientTemp || ''},${report.humidity || ''},"${notes}"\n`;
  });
  
  return csv;
}

export function generateDailyReportsCSV(): string {
  let csv = 'Date,Total Batches,Avg Duration (min),Total Cost,Workflows\n';
  
  reportsData.daily.forEach(report => {
    const workflows = Object.entries(report.batchesByWorkflow)
      .map(([wf, count]) => `${wf}:${count}`)
      .join('; ');
    const cost = report.totalIngredientCost ? `${report.totalIngredientCost.toFixed(2)}` : '';
    
    csv += `${report.date},${report.totalBatches},${report.averageDuration},${cost},"${workflows}"\n`;
  });
  
  return csv;
}

export async function importReportsFromJSON(jsonString: string): Promise<void> {
  try {
    const imported: ReportsData = JSON.parse(jsonString);
    
    if (!imported.environmental || !imported.batchCompletions || !imported.daily) {
      throw new Error('Invalid reports data structure');
    }

    reportsData = imported;
    await saveReports();
    
    // Sync imported data to Supabase
    await forceSyncToSupabase();
  } catch (error) {
    console.error('Error importing reports:', error);
    throw error;
  }
}

export async function clearAllReports(): Promise<void> {
  reportsData = {
    environmental: [],
    batchCompletions: [],
    daily: [],
  };
  await saveReports();
}