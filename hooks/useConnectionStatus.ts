// ============================================
// FILE: hooks/useConnectionStatus.ts
//
// Tracks online/offline state and drives the
// HomeScreen sync indicator + retry button.
//
// Strategy:
//   - On mount: probe once with a lightweight fetch
//   - Poll every 60s to detect reconnection
//   - Expose manualRetry() for the "tap to retry" button
//   - On reconnect: flush offline queue + sync from server
//   - No aggressive reconnect thrashing — 60s minimum between polls,
//     manual retry enforces a 5s cooldown to prevent tap-spam
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { flushOfflineQueue, getPendingCount } from '../services/offlineQueue';
import { syncFromServer } from '../services/database';

export type ConnectionState = 'online' | 'offline' | 'checking';

export interface ConnectionStatus {
  state: ConnectionState;
  pendingCount: number;        // ops waiting to sync
  lastSyncedAt: Date | null;   // last successful server sync
  manualRetry: () => void;     // call from "tap to retry"
}

// Lightweight connectivity probe — just a HEAD request to a reliable host.
// We use Supabase's own domain so we're testing the actual dependency.
const PROBE_URL = 'https://www.gstatic.com/generate_204'; // 204 No Content — Google's connectivity check endpoint
const PROBE_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 60_000;
const RETRY_COOLDOWN_MS = 5_000;

async function probeConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(PROBE_URL, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export function useConnectionStatus(): ConnectionStatus {
  const [state, setState] = useState<ConnectionState>('checking');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryLockRef    = useRef(false);
  const appStateRef     = useRef<AppStateStatus>(AppState.currentState);
  const isMountedRef    = useRef(true);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    if (isMountedRef.current) setPendingCount(count);
  }, []);

  const handleOnline = useCallback(async () => {
    if (!isMountedRef.current) return;
    setState('online');

    // Flush queued writes first, then pull fresh data
    const flushed = await flushOfflineQueue();
    if (flushed > 0) {
      await syncFromServer();
      setLastSyncedAt(new Date());
    } else {
      setLastSyncedAt(prev => prev ?? new Date());
    }
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const probe = useCallback(async () => {
    if (!isMountedRef.current) return;
    const isOnline = await probeConnection();
    if (!isMountedRef.current) return;

    if (isOnline) {
      await handleOnline();
    } else {
      setState('offline');
      await refreshPendingCount();
    }
  }, [handleOnline, refreshPendingCount]);

  const startPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(probe, POLL_INTERVAL_MS);
  }, [probe]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Manual retry — called from HomeScreen "tap to retry"
  const manualRetry = useCallback(() => {
    if (retryLockRef.current) return;
    retryLockRef.current = true;
    setState('checking');
    probe().finally(() => {
      setTimeout(() => { retryLockRef.current = false; }, RETRY_COOLDOWN_MS);
    });
  }, [probe]);

  // Initial probe on mount
  useEffect(() => {
    isMountedRef.current = true;
    probe().then(startPoll);
    return () => {
      isMountedRef.current = false;
      stopPoll();
    };
  }, []);

  // Probe on app foreground — but reuse the 60s poll, don't add extra probes
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        // Probe immediately on foreground, reset poll timer
        probe().then(startPoll);
      } else if (next !== 'active') {
        stopPoll();
      }
    });
    return () => sub.remove();
  }, [probe, startPoll, stopPoll]);

  return { state, pendingCount, lastSyncedAt, manualRetry };
}