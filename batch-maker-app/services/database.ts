
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Step {
  id: string;
  title: string;
  description: string;
  timerMinutes?: number;
  completed?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  steps: Step[];
  claimedBy?: string; // Device ID that claimed this workflow
  claimedByName?: string; // Device name for display
}

export interface Timer {
  id: string;
  stepId: string;
  startedAt: number;
  duration: number;
  acknowledged: boolean;
}

export interface Batch {
  id: string;
  workflowId: string;
  name: string;
  mode: 'bake-today' | 'cold-ferment';
  unitsPerBatch: number;
  batchSizeMultiplier: number; // 0.5, 1, 2, 3, etc.
  currentStepIndex: number;
  completedSteps: string[];
  activeTimers: Timer[];
  createdAt: number;
}

const WORKFLOWS_KEY = '@workflows';
const BATCHES_KEY = '@batches';
const DEVICE_ID_KEY = '@device_id';
const DEVICE_NAME_KEY = '@device_name';

let workflows: Workflow[] = [];
let batches: Batch[] = [];
let deviceId: string = '';
let deviceName: string = '';

// ============================================
// DEVICE MANAGEMENT
// ============================================

export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  
  let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!storedId) {
    storedId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
  }
  deviceId = storedId;
  return deviceId;
}

export async function getDeviceName(): Promise<string> {
  if (deviceName) return deviceName;
  
  const storedName = await AsyncStorage.getItem(DEVICE_NAME_KEY);
  deviceName = storedName || 'Unnamed Station';
  return deviceName;
}

export async function setDeviceName(name: string): Promise<void> {
  deviceName = name;
  await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
}

// ============================================
// INITIALIZATION
// ============================================

export async function initializeDatabase(): Promise<void> {
  try {
    const [storedWorkflows, storedBatches] = await Promise.all([
      AsyncStorage.getItem(WORKFLOWS_KEY),
      AsyncStorage.getItem(BATCHES_KEY)
    ]);
    
    if (storedWorkflows) {
      workflows = JSON.parse(storedWorkflows);
      console.log(`Loaded ${workflows.length} workflows`);
    }
    
    if (storedBatches) {
      batches = JSON.parse(storedBatches);
      console.log(`Loaded ${batches.length} batches`);
    }

    // Initialize device ID
    await getDeviceId();
    await getDeviceName();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

async function saveWorkflows(): Promise<void> {
  try {
    await AsyncStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
  } catch (error) {
    console.error('Error saving workflows:', error);
  }
}

async function saveBatches(): Promise<void> {
  try {
    await AsyncStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
  } catch (error) {
    console.error('Error saving batches:', error);
  }
}

// ============================================
// WORKFLOW MANAGEMENT
// ============================================

export function getWorkflows(): Workflow[] {
  return workflows;
}

export async function setWorkflows(newWorkflows: Workflow[]): Promise<void> {
  workflows = newWorkflows;
  await saveWorkflows();
}

export async function addWorkflow(newWorkflow: Workflow): Promise<void> {
  console.log('📥 addWorkflow called with:', newWorkflow.name);
  console.log('📊 Current workflows count:', workflows.length);
  
  workflows.push(newWorkflow);
  
  console.log('📊 New workflows count:', workflows.length);
  console.log('💾 Saving to AsyncStorage...');
  
  await saveWorkflows();
  
  console.log('✅ Save complete');
}

export async function resetWorkflows(): Promise<void> {
  workflows = [];
  await saveWorkflows();
}

export function markStepCompleted(workflowId: string, stepId: string, completed: boolean) {
  const wf = workflows.find((w) => w.id === workflowId);
  if (!wf) return;
  const step = wf.steps.find((s) => s.id === stepId);
  if (!step) return;
  step.completed = completed;
  saveWorkflows();
}

// ============================================
// WORKFLOW CLAIMS
// ============================================

export async function claimWorkflow(workflowId: string): Promise<void> {
  const workflow = workflows.find(w => w.id === workflowId);
  if (!workflow) return;
  
  const currentDeviceId = await getDeviceId();
  const currentDeviceName = await getDeviceName();
  
  workflow.claimedBy = currentDeviceId;
  workflow.claimedByName = currentDeviceName;
  await saveWorkflows();
}

export async function unclaimWorkflow(workflowId: string): Promise<void> {
  const workflow = workflows.find(w => w.id === workflowId);
  if (!workflow) return;
  
  workflow.claimedBy = undefined;
  workflow.claimedByName = undefined;
  await saveWorkflows();
}

export async function getClaimedWorkflows(): Promise<Workflow[]> {
  const currentDeviceId = await getDeviceId();
  return workflows.filter(w => w.claimedBy === currentDeviceId);
}

export async function getUnclaimedWorkflows(): Promise<Workflow[]> {
  return workflows.filter(w => !w.claimedBy);
}

export async function isWorkflowClaimedByMe(workflowId: string): Promise<boolean> {
  const workflow = workflows.find(w => w.id === workflowId);
  if (!workflow || !workflow.claimedBy) return false;
  
  const currentDeviceId = await getDeviceId();
  return workflow.claimedBy === currentDeviceId;
}

// ============================================
// BATCH MANAGEMENT
// ============================================

export function getBatches(): Batch[] {
  return JSON.parse(JSON.stringify(batches));
}

export function getBatch(batchId: string): Batch | undefined {
  const batch = batches.find(b => b.id === batchId);
  return batch ? JSON.parse(JSON.stringify(batch)) : undefined;
}

export async function createBatch(
  workflowId: string,
  mode: 'bake-today' | 'cold-ferment',
  unitsPerBatch: number = 1,
  batchSizeMultiplier: number = 1
): Promise<Batch> {
  const workflow = workflows.find(w => w.id === workflowId);
  if (!workflow) throw new Error('Workflow not found');

  const batch: Batch = {
    id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workflowId,
    name: workflow.name,
    mode,
    unitsPerBatch,
    batchSizeMultiplier,
    currentStepIndex: 0,
    completedSteps: [],
    activeTimers: [],
    createdAt: Date.now(),
  };

  batches.push(batch);
  await saveBatches();
  return batch;
}

export async function duplicateBatch(batchId: string): Promise<Batch> {
  const original = batches.find(b => b.id === batchId);
  if (!original) throw new Error('Batch not found');

  const newBatch: Batch = {
    id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workflowId: original.workflowId,
    name: original.name,
    mode: original.mode,
    unitsPerBatch: original.unitsPerBatch,
    batchSizeMultiplier: original.batchSizeMultiplier,
    currentStepIndex: 0,
    completedSteps: [],
    activeTimers: [],
    createdAt: Date.now(),
  };

  batches.push(newBatch);
  await saveBatches();
  return newBatch;
}

export async function renameBatch(batchId: string, newName: string): Promise<void> {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;
  
  batch.name = newName;
  await saveBatches();
}

export async function deleteBatch(batchId: string): Promise<void> {
  batches = batches.filter(b => b.id !== batchId);
  await saveBatches();
}

export function batchHasProgress(batchId: string): boolean {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return false;
  return batch.currentStepIndex > 0 || batch.completedSteps.length > 0 || batch.activeTimers.length > 0;
}

// ============================================
// BATCH STEP MANAGEMENT
// ============================================

export async function updateBatchSize(batchId: string, multiplier: number): Promise<void> {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;
  
  batch.batchSizeMultiplier = multiplier;
  await saveBatches();
}

export async function updateBatchStep(batchId: string, stepIndex: number): Promise<void> {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;
  
  batch.currentStepIndex = stepIndex;
  await saveBatches();
}

export async function completeBatchStep(batchId: string, stepId: string): Promise<void> {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;
  
  if (!batch.completedSteps.includes(stepId)) {
    batch.completedSteps.push(stepId);
  }
  await saveBatches();
}

// ============================================
// TIMER MANAGEMENT
// ============================================

export async function startTimer(
  batchId: string,
  stepId: string,
  durationMinutes: number
): Promise<void> {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;

  const timer: Timer = {
    id: `timer_${Date.now()}`,
    stepId,
    startedAt: Date.now(),
    duration: durationMinutes * 60,
    acknowledged: false,
  };

  batch.activeTimers.push(timer);
  await saveBatches();
}

export async function stopTimer(batchId: string, timerId: string): Promise<void> {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;

  batch.activeTimers = batch.activeTimers.filter(t => t.id !== timerId);
  await saveBatches();
}

export async function acknowledgeTimer(batchId: string, timerId: string): Promise<void> {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;

  const timer = batch.activeTimers.find(t => t.id === timerId);
  if (timer) {
    timer.acknowledged = true;
    await saveBatches();
  }
}

export function getTimerStatus(timer: Timer): {
  remainingSeconds: number;
  isExpired: boolean;
  elapsedSeconds: number;
} {
  const now = Date.now();
  const elapsedMs = now - timer.startedAt;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remainingSeconds = timer.duration - elapsedSeconds;

  return {
    remainingSeconds: Math.max(0, remainingSeconds),
    isExpired: remainingSeconds <= 0,
    elapsedSeconds,
  };
}

export function getMostUrgentTimer(batch: Batch): Timer | null {
  if (batch.activeTimers.length === 0) return null;

  const expired = batch.activeTimers.find(t => getTimerStatus(t).isExpired);
  if (expired) return expired;

  return batch.activeTimers.reduce((mostUrgent, timer) => {
    const urgentRemaining = getTimerStatus(mostUrgent).remainingSeconds;
    const currentRemaining = getTimerStatus(timer).remainingSeconds;
    return currentRemaining < urgentRemaining ? timer : mostUrgent;
  });
}

export function batchHasExpiredTimer(batch: Batch): boolean {
  return batch.activeTimers.some(t => getTimerStatus(t).isExpired && !t.acknowledged);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}