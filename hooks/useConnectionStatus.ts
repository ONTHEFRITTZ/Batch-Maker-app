// ============================================
// FILE: hooks/useConnectionStatus.ts
// Tracks real-time connectivity state,
// pending offline queue count, last sync
// time, and exposes a manualRetry function.
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushOfflineQueue, getPendingCount } from '../services/offlineQueue';
import { syncFromServer } from '../services/database';

export type ConnectionState = 'online' | 'offline' | 'checking';

export interface ConnectionStatus {
  state: ConnectionState;
  pendingCount: number;
  lastSyncedAt: Date | null;
  manualRetry: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000; // re-check pending count every 30s

export function useConnectionStatus(): ConnectionStatus {
  const [state, setState] = useState<ConnectionState>('checking');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncing = useRef(false);

  // ── Sync helper ────────────────────────────────────────────────────────────
  const performSync = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    try {
      await flushOfflineQueue();
      await syncFromServer();
      setLastSyncedAt(new Date());
    } catch (err) {
      console.warn('[useConnectionStatus] sync error:', err);
    } finally {
      const count = await getPendingCount();
      setPendingCount(count);
      isSyncing.current = false;
    }
  }, []);

  // ── NetInfo listener ───────────────────────────────────────────────────────
  useEffect(() => {
    // Initial check
    setState('checking');
    getPendingCount().then(setPendingCount);

    const unsubscribe = NetInfo.addEventListener(netState => {
      const isConnected = netState.isConnected && netState.isInternetReachable !== false;

      if (isConnected) {
        setState('online');
        performSync();
      } else if (netState.isConnected === false) {
        setState('offline');
      } else {
        // isInternetReachable is null — still checking
        setState('checking');
      }
    });

    return () => unsubscribe();
  }, [performSync]);

  // ── Periodic pending count poll ────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Manual retry ───────────────────────────────────────────────────────────
  const manualRetry = useCallback(async () => {
    setState('checking');
    try {
      await performSync();
      setState('online');
    } catch {
      setState('offline');
    }
  }, [performSync]);

  return { state, pendingCount, lastSyncedAt, manualRetry };
}