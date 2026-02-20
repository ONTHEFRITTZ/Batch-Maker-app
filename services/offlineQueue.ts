// ============================================
// FILE: services/offlineQueue.ts
// Stores mutations that failed offline and
// replays them when internet is restored.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const QUEUE_KEY = '@offline_queue';

export interface QueuedOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  payload: any;
  queuedAt: string;
}

// ── Read / write queue ────────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedOperation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Add a failed mutation to the queue so it can be retried later. */
export async function enqueueOperation(op: Omit<QueuedOperation, 'id' | 'queuedAt'>): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...op,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    queuedAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

/** Returns how many operations are waiting to be synced. */
export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/**
 * Attempt to flush all queued operations to Supabase.
 * Call this when the app comes back online.
 * Operations that succeed are removed; failures stay in the queue.
 */
export async function flushOfflineQueue(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // Not authenticated yet — leave queue intact

  const failed: QueuedOperation[] = [];

  for (const op of queue) {
    try {
      let error: any = null;

      if (op.operation === 'upsert') {
        ({ error } = await supabase.from(op.table).upsert(op.payload));
      } else if (op.operation === 'insert') {
        ({ error } = await supabase.from(op.table).insert(op.payload));
      } else if (op.operation === 'update') {
        ({ error } = await supabase.from(op.table).update(op.payload.updates).eq('id', op.payload.id));
      } else if (op.operation === 'delete') {
        ({ error } = await supabase.from(op.table).delete().eq('id', op.payload.id));
      }

      if (error) {
        console.warn(`[offlineQueue] Failed to flush op ${op.id}:`, error.message);
        failed.push(op);
      }
    } catch (err) {
      console.warn(`[offlineQueue] Exception flushing op ${op.id}:`, err);
      failed.push(op);
    }
  }

  await writeQueue(failed);

  if (failed.length === 0) {
    console.log('[offlineQueue] All queued operations flushed successfully');
  } else {
    console.warn(`[offlineQueue] ${failed.length} operation(s) remain after flush`);
  }
}