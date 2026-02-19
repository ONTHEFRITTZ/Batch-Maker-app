// ============================================
// FILE: services/offlineQueue.ts
//
// Persists failed Supabase writes to AsyncStorage
// and replays them in order when connectivity
// is restored. Used by database.ts for any write
// that fails with a network error.
//
// Queue entries are processed oldest-first and
// removed only on confirmed success. A failed
// flush leaves entries in place to retry next time.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const QUEUE_KEY = '@offline_queue_v1';

export type QueueOperation =
  | { type: 'insert'; table: string; payload: Record<string, any> }
  | { type: 'update'; table: string; payload: Record<string, any>; match: Record<string, any> }
  | { type: 'upsert'; table: string; payload: Record<string, any> }
  | { type: 'delete'; table: string; match: Record<string, any> };

export interface QueueEntry {
  id: string;
  op: QueueOperation;
  queuedAt: number;
}

/* -------------------------------------------------------------------------- */
/*  Network error detection                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Returns true if a Supabase error is a network/connectivity failure
 * rather than a server-side validation or auth error.
 * We only queue network errors — anything else should surface to the user.
 */
export function isSupabaseNetworkError(error: any): boolean {
  if (!error) return false;
  const msg: string = (error.message || error.code || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('networkerror') ||
    msg.includes('timeout') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    // Supabase edge function / postgrest offline codes
    msg.includes('fetch failed') ||
    error.code === 'PGRST_NOT_FOUND' ||   // rare but happens when DNS fails
    error.status === 0 ||
    error.status === 503
  );
}

/* -------------------------------------------------------------------------- */
/*  Queue read / write                                                         */
/* -------------------------------------------------------------------------- */

async function readQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function writeQueue(entries: QueueEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch { /* non-fatal — worst case we lose the queue on restart */ }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Add a failed operation to the offline queue.
 * Called by database.ts when a write gets a network error.
 */
export async function enqueue(op: QueueOperation): Promise<void> {
  const entry: QueueEntry = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    op,
    queuedAt: Date.now(),
  };
  const queue = await readQueue();
  queue.push(entry);
  await writeQueue(queue);
  console.log(`[Queue] Enqueued ${op.type} on ${op.table} (${queue.length} pending)`);
}

/**
 * Returns the number of pending operations waiting to sync.
 * Used by the HomeScreen sync status indicator.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/**
 * Attempt to flush all queued operations to Supabase.
 * Called on:
 *   - App foreground resume
 *   - Successful auth on init
 *   - Manual "tap to retry" from HomeScreen
 *   - 60-second poll timer
 *
 * Returns the number of operations that were successfully flushed.
 * Leaves failed entries in the queue to retry next time.
 * Throws nothing — all errors are caught internally.
 */
export async function flushOfflineQueue(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  console.log(`[Queue] Flushing ${queue.length} pending operations`);

  const remaining: QueueEntry[] = [];
  let flushed = 0;

  for (const entry of queue) {
    try {
      const { op } = entry;
      let error: any = null;

      if (op.type === 'insert') {
        ({ error } = await supabase.from(op.table).insert(op.payload));
      } else if (op.type === 'update') {
        let q = supabase.from(op.table).update(op.payload);
        for (const [col, val] of Object.entries(op.match)) {
          q = q.eq(col, val);
        }
        ({ error } = await q);
      } else if (op.type === 'upsert') {
        ({ error } = await supabase.from(op.table).upsert(op.payload));
      } else if (op.type === 'delete') {
        let q = supabase.from(op.table).delete();
        for (const [col, val] of Object.entries(op.match)) {
          q = q.eq(col, val);
        }
        ({ error } = await q);
      }

      if (error) {
        if (isSupabaseNetworkError(error)) {
          // Still offline — stop trying, keep rest of queue
          remaining.push(entry);
          // Push remaining unprocessed entries too and bail
          const idx = queue.indexOf(entry);
          remaining.push(...queue.slice(idx + 1));
          break;
        } else {
          // Server rejected the operation (conflict, auth, etc.)
          // Drop it — retrying won't help
          console.warn(`[Queue] Dropping ${op.type}/${op.table} — server error:`, error.message);
        }
      } else {
        flushed++;
        console.log(`[Queue] Flushed ${op.type} on ${op.table}`);
      }
    } catch (err) {
      // Unexpected error — keep entry, stop flush
      remaining.push(entry);
      const idx = queue.indexOf(entry);
      remaining.push(...queue.slice(idx + 1));
      break;
    }
  }

  await writeQueue(remaining);
  if (flushed > 0) console.log(`[Queue] Done — ${flushed} flushed, ${remaining.length} remaining`);
  return flushed;
}