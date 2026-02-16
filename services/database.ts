// ============================================
// FILE: services/database.ts
// SUPABASE VERSION - Works with existing schema
// Handles snake_case <-> camelCase conversion
// ============================================

import { supabase } from './supabaseClient';

export interface Step {
  id: string;
  title: string;
  description: string;
  timerMinutes?: number;
  completed?: boolean;
  ingredients?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  steps: Step[];
  claimedBy?: string;
  claimedByName?: string;
  user_id?: string;
  location_id?: string;
  description?: string;
  ingredients?: any[];
  servings?: string;
  source_url?: string;
  total_time_minutes?: number;
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
  archived_at?: string;
  show_ferment_prompt?: boolean;
}

export interface Timer {
  id: string;
  stepId: string;
  startedAt: number;
  duration: number; // in seconds
  acknowledged: boolean;
}

export interface Batch {
  id: string;
  workflowId: string;
  name: string;
  mode: 'bake-today' | 'cold-ferment';
  unitsPerBatch: number;
  batchSizeMultiplier: number;
  currentStepIndex: number;
  completedSteps: string[];
  activeTimers: Timer[];
  createdAt: number;
  user_id?: string;
  location_id?: string;
  created_at?: string;
  updated_at?: string;
}

// In-memory cache
let cachedWorkflows: Workflow[] = [];
let cachedBatches: Batch[] = [];

// ============================================
// DEVICE MANAGEMENT
// ============================================

export async function getDeviceId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || '';
}

export async function getDeviceName(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return 'Unnamed Station';
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('device_name')
    .eq('id', user.id)
    .single();
  
  return profile?.device_name || user.email || 'Unnamed Station';
}

export async function setDeviceName(name: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');
  
  await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      device_name: name,
      updated_at: new Date().toISOString(),
    });
}

// ============================================
// INITIALIZATION
// ============================================

export async function initializeDatabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('No user authenticated');
      cachedWorkflows = [];
      cachedBatches = [];
      return;
    }

    const [workflows, batches] = await Promise.all([
      getWorkflows(),
      _refreshBatches(),
    ]);

    cachedWorkflows = workflows;
    cachedBatches = batches;

    console.log(`Loaded ${workflows.length} workflows and ${batches.length} batches`);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// ============================================
// WORKFLOW MANAGEMENT
// ============================================

export async function getWorkflows(): Promise<Workflow[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflows:', error);
      return cachedWorkflows;
    }

    cachedWorkflows = data || [];
    return cachedWorkflows;
  } catch (err) {
    console.error('Error in getWorkflows:', err);
    return cachedWorkflows;
  }
}

export async function setWorkflows(newWorkflows: Workflow[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Must be signed in');

    const currentWorkflows = await getWorkflows();
    const newWorkflowIds = new Set(newWorkflows.map(w => w.id));
    
    const workflowsToDelete = currentWorkflows.filter(w => !newWorkflowIds.has(w.id));
    for (const workflow of workflowsToDelete) {
      await supabase
        .from('workflows')
        .delete()
        .eq('id', workflow.id)
        .eq('user_id', user.id);
    }

    for (const workflow of newWorkflows) {
      await supabase
        .from('workflows')
        .upsert({
          id: workflow.id,
          name: workflow.name,
          steps: workflow.steps,
          user_id: user.id,
          claimed_by: workflow.claimedBy || null,
          claimed_by_name: workflow.claimedByName || null,
          archived: workflow.archived || false,
          archived_at: workflow.archived_at || null,
          show_ferment_prompt: workflow.show_ferment_prompt ?? true,
          updated_at: new Date().toISOString(),
        });
    }

    cachedWorkflows = newWorkflows;
  } catch (err) {
    console.error('Error setting workflows:', err);
    throw err;
  }
}

export async function addWorkflow(newWorkflow: Workflow): Promise<void> {
  try {
    console.log('📥 addWorkflow called:', newWorkflow.name);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Must be signed in to create workflows');

    const { error } = await supabase.from('workflows').insert({
      id: newWorkflow.id,
      name: newWorkflow.name,
      steps: newWorkflow.steps,
      user_id: user.id,
      claimed_by: newWorkflow.claimedBy || null,
      claimed_by_name: newWorkflow.claimedByName || null,
      archived: newWorkflow.archived || false,
      archived_at: newWorkflow.archived_at || null,
      show_ferment_prompt: newWorkflow.show_ferment_prompt ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    console.log('✅ Workflow saved');
    cachedWorkflows.push({ ...newWorkflow, user_id: user.id });
  } catch (err) {
    console.error('Error adding workflow:', err);
    throw err;
  }
}

export async function resetWorkflows(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('workflows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    cachedWorkflows = [];
  } catch (err) {
    console.error('Error resetting workflows:', err);
    throw err;
  }
}

export async function markStepCompleted(workflowId: string, stepId: string, completed: boolean): Promise<void> {
  const workflow = cachedWorkflows.find(w => w.id === workflowId);
  if (!workflow) return;
  
  const step = workflow.steps.find(s => s.id === stepId);
  if (!step) return;
  
  step.completed = completed;
  
  await supabase
    .from('workflows')
    .update({
      steps: workflow.steps,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workflowId);
}

export async function archiveWorkflow(workflowId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be signed in');

    const { error } = await supabase
      .from('workflows')
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .eq('user_id', user.id);

    if (error) throw error;

    const workflow = cachedWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      workflow.archived = true;
      workflow.archived_at = new Date().toISOString();
    }

    await getWorkflows();
  } catch (err) {
    console.error('Error archiving workflow:', err);
    throw err;
  }
}

export async function unarchiveWorkflow(workflowId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be signed in');

    const { error } = await supabase
      .from('workflows')
      .update({
        archived: false,
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .eq('user_id', user.id);

    if (error) throw error;

    const workflow = cachedWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      workflow.archived = false;
      workflow.archived_at = undefined;
    }

    await getWorkflows();
  } catch (err) {
    console.error('Error unarchiving workflow:', err);
    throw err;
  }
}

// ============================================
// WORKFLOW CLAIMS
// ============================================

export async function claimWorkflow(workflowId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be signed in');

    const deviceName = await getDeviceName();

    const { error } = await supabase
      .from('workflows')
      .update({
        claimed_by: user.id,
        claimed_by_name: deviceName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId);

    if (error) throw error;

    const workflow = cachedWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      workflow.claimedBy = user.id;
      workflow.claimedByName = deviceName;
    }
  } catch (err) {
    console.error('Error claiming workflow:', err);
    throw err;
  }
}

export async function unclaimWorkflow(workflowId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be signed in');

    const { error } = await supabase
      .from('workflows')
      .update({
        claimed_by: null,
        claimed_by_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .eq('claimed_by', user.id);

    if (error) throw error;

    const workflow = cachedWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      workflow.claimedBy = undefined;
      workflow.claimedByName = undefined;
    }
  } catch (err) {
    console.error('Error unclaiming workflow:', err);
    throw err;
  }
}

export async function getClaimedWorkflows(): Promise<Workflow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return cachedWorkflows.filter(w => w.claimedBy === user.id);
}

export async function getUnclaimedWorkflows(): Promise<Workflow[]> {
  return cachedWorkflows.filter(w => !w.claimedBy);
}

export async function isWorkflowClaimedByMe(workflowId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const workflow = cachedWorkflows.find(w => w.id === workflowId);
  return workflow?.claimedBy === user.id;
}

// ============================================
// BATCH MANAGEMENT
// ============================================

function dbBatchToApp(dbBatch: any): Batch {
  return {
    id: dbBatch.id,
    workflowId: dbBatch.workflow_id,
    name: dbBatch.name,
    mode: dbBatch.mode,
    unitsPerBatch: dbBatch.units_per_batch || 1,
    batchSizeMultiplier: dbBatch.batch_size_multiplier || 1,
    currentStepIndex: dbBatch.current_step_index || 0,
    completedSteps: dbBatch.completed_steps || [],
    activeTimers: dbBatch.active_timers || [],
    createdAt: new Date(dbBatch.created_at).getTime(),
    user_id: dbBatch.user_id,
    location_id: dbBatch.location_id,
    created_at: dbBatch.created_at,
    updated_at: dbBatch.updated_at,
  };
}

export function getBatches(): Batch[] {
  return JSON.parse(JSON.stringify(cachedBatches));
}

export async function _refreshBatches(): Promise<Batch[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching batches:', error);
      return cachedBatches;
    }

    cachedBatches = (data || []).map(dbBatchToApp);
    return cachedBatches;
  } catch (err) {
    console.error('Error refreshing batches:', err);
    return cachedBatches;
  }
}

export function getBatch(batchId: string): Batch | undefined {
  const batch = cachedBatches.find(b => b.id === batchId);
  return batch ? JSON.parse(JSON.stringify(batch)) : undefined;
}

export async function createBatch(
  workflowId: string,
  mode: 'bake-today' | 'cold-ferment',
  unitsPerBatch: number = 1,
  batchSizeMultiplier: number = 1
): Promise<Batch> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be signed in');

    const workflow = cachedWorkflows.find(w => w.id === workflowId);
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

    const { error } = await supabase.from('batches').insert({
      id: batch.id,
      workflow_id: batch.workflowId,
      name: batch.name,
      mode: batch.mode,
      units_per_batch: batch.unitsPerBatch,
      batch_size_multiplier: batch.batchSizeMultiplier,
      current_step_index: batch.currentStepIndex,
      completed_steps: batch.completedSteps,
      active_timers: batch.activeTimers,
      user_id: user.id,
      location_id: workflow.location_id || null,
      created_at: new Date(batch.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    cachedBatches.push({ ...batch, user_id: user.id });
    return batch;
  } catch (err) {
    console.error('Error creating batch:', err);
    throw err;
  }
}

export async function duplicateBatch(batchId: string): Promise<Batch> {
  try {
    const original = cachedBatches.find(b => b.id === batchId);
    if (!original) throw new Error('Batch not found');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be signed in');

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

    const { error } = await supabase.from('batches').insert({
      id: newBatch.id,
      workflow_id: newBatch.workflowId,
      name: newBatch.name,
      mode: newBatch.mode,
      units_per_batch: newBatch.unitsPerBatch,
      batch_size_multiplier: newBatch.batchSizeMultiplier,
      current_step_index: newBatch.currentStepIndex,
      completed_steps: newBatch.completedSteps,
      active_timers: newBatch.activeTimers,
      user_id: user.id,
      location_id: original.location_id || null,
      created_at: new Date(newBatch.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    cachedBatches.push({ ...newBatch, user_id: user.id });
    return newBatch;
  } catch (err) {
    console.error('Error duplicating batch:', err);
    throw err;
  }
}

export async function renameBatch(batchId: string, newName: string): Promise<void> {
  try {
    const batch = cachedBatches.find(b => b.id === batchId);
    if (!batch) return;
    
    batch.name = newName;

    await supabase
      .from('batches')
      .update({
        name: newName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);
  } catch (err) {
    console.error('Error renaming batch:', err);
    throw err;
  }
}

export async function deleteBatch(batchId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be signed in');

    await supabase
      .from('batches')
      .delete()
      .eq('id', batchId)
      .eq('user_id', user.id);

    cachedBatches = cachedBatches.filter(b => b.id !== batchId);
  } catch (err) {
    console.error('Error deleting batch:', err);
    throw err;
  }
}

export function batchHasProgress(batchId: string): boolean {
  const batch = cachedBatches.find(b => b.id === batchId);
  if (!batch) return false;
  return batch.currentStepIndex > 0 || batch.completedSteps.length > 0 || batch.activeTimers.length > 0;
}

// ============================================
// BATCH STEP MANAGEMENT
// ============================================

async function _updateBatch(batchId: string, updates: any): Promise<void> {
  const batch = cachedBatches.find(b => b.id === batchId);
  if (!batch) return;

  const dbUpdates: any = { updated_at: new Date().toISOString() };
  
  if (updates.batchSizeMultiplier !== undefined) dbUpdates.batch_size_multiplier = updates.batchSizeMultiplier;
  if (updates.currentStepIndex !== undefined) dbUpdates.current_step_index = updates.currentStepIndex;
  if (updates.completedSteps !== undefined) dbUpdates.completed_steps = updates.completedSteps;
  if (updates.activeTimers !== undefined) dbUpdates.active_timers = updates.activeTimers;

  Object.assign(batch, updates);

  await supabase
    .from('batches')
    .update(dbUpdates)
    .eq('id', batchId);
}

export async function updateBatchSize(batchId: string, multiplier: number): Promise<void> {
  await _updateBatch(batchId, { batchSizeMultiplier: multiplier });
}

export async function updateBatchStep(batchId: string, stepIndex: number): Promise<void> {
  await _updateBatch(batchId, { currentStepIndex: stepIndex });
}

export async function completeBatchStep(batchId: string, stepId: string): Promise<void> {
  const batch = cachedBatches.find(b => b.id === batchId);
  if (!batch) return;
  
  if (!batch.completedSteps.includes(stepId)) {
    batch.completedSteps.push(stepId);
    await _updateBatch(batchId, { completedSteps: batch.completedSteps });
  }
}

// ============================================
// TIMER MANAGEMENT
// ============================================

export async function startTimer(
  batchId: string,
  stepId: string,
  durationMinutes: number
): Promise<void> {
  const batch = cachedBatches.find(b => b.id === batchId);
  if (!batch) return;

  const timer: Timer = {
    id: `timer_${Date.now()}`,
    stepId,
    startedAt: Date.now(),
    duration: durationMinutes * 60,
    acknowledged: false,
  };

  batch.activeTimers.push(timer);
  await _updateBatch(batchId, { activeTimers: batch.activeTimers });
}

export async function stopTimer(batchId: string, timerId: string): Promise<void> {
  const batch = cachedBatches.find(b => b.id === batchId);
  if (!batch) return;

  batch.activeTimers = batch.activeTimers.filter(t => t.id !== timerId);
  await _updateBatch(batchId, { activeTimers: batch.activeTimers });
}

export async function acknowledgeTimer(batchId: string, timerId: string): Promise<void> {
  const batch = cachedBatches.find(b => b.id === batchId);
  if (!batch) return;

  const timer = batch.activeTimers.find(t => t.id === timerId);
  if (timer) {
    timer.acknowledged = true;
    await _updateBatch(batchId, { activeTimers: batch.activeTimers });
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

// ============================================
// REAL-TIME SYNC
// ============================================

export async function syncFromServer(): Promise<void> {
  await Promise.all([
    getWorkflows(),
    _refreshBatches(),
  ]);
}