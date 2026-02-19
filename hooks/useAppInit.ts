// ============================================
// FILE: hooks/useAppInit.ts
//
// Handles app startup auth + database init with
// offline fallback. Replaces the bare getSession()
// call that hangs forever when there's no internet.
//
// Flow:
//   1. Load persisted data from AsyncStorage immediately
//      (UI can render right away with cached data)
//   2. Race Supabase getSession() against a 5s timeout
//   3a. Session found → init database normally
//   3b. Timeout/error → check AsyncStorage for cached
//       session → drop into offline mode if found
//   3c. No cached session + no internet → show sign-in
//
// The app never hangs. Worst case it shows sign-in
// (which is correct — no cached user means new device).
// ============================================

import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { initializeDatabase } from '../services/database';
import { flushOfflineQueue } from '../services/offlineQueue';

export type AppInitState =
  | 'loading'      // initial — show splash
  | 'online'       // authed + connected
  | 'offline'      // authed + no internet (loaded from cache)
  | 'unauthenticated'; // no user, no cached session

export interface AppInitResult {
  initState: AppInitState;
  userId: string | null;
  userEmail: string | null;
}

const SESSION_TIMEOUT_MS = 5000;
const CACHED_USER_KEY = '@cached_user_v1';

interface CachedUser { id: string; email: string | null; }

async function getSessionWithTimeout(): Promise<any> {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session timeout')), SESSION_TIMEOUT_MS)
    ),
  ]);
}

export function useAppInit(): AppInitResult {
  const [initState, setInitState] = useState<AppInitState>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    init();
    return () => { isMountedRef.current = false; };
  }, []);

  async function init() {
    try {
      // Step 1: Try to get session from Supabase with timeout
      const { data: { session } } = await getSessionWithTimeout();

      if (!isMountedRef.current) return;

      if (session?.user) {
        // Online + authenticated
        await AsyncStorage.setItem(
          CACHED_USER_KEY,
          JSON.stringify({ id: session.user.id, email: session.user.email ?? null })
        );
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);

        // Init DB (loads persisted cache first, then syncs)
        await initializeDatabase();

        // Flush any queued offline writes
        await flushOfflineQueue();

        if (isMountedRef.current) setInitState('online');
      } else {
        // Supabase responded but no session — user is signed out
        await AsyncStorage.removeItem(CACHED_USER_KEY);
        if (isMountedRef.current) setInitState('unauthenticated');
      }
    } catch (err) {
      // Timeout or network error — try cached session
      if (!isMountedRef.current) return;
      console.warn('[AppInit] Supabase unreachable, trying cached session:', err);

      try {
        const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
        if (raw) {
          const cached: CachedUser = JSON.parse(raw);
          // Load whatever we have in AsyncStorage and go offline
          await initializeDatabase(); // will load from AsyncStorage only since network is down
          if (isMountedRef.current) {
            setUserId(cached.id);
            setUserEmail(cached.email);
            setInitState('offline');
          }
        } else {
          // No cache, no network — must sign in when online
          if (isMountedRef.current) setInitState('unauthenticated');
        }
      } catch {
        if (isMountedRef.current) setInitState('unauthenticated');
      }
    }
  }

  return { initState, userId, userEmail };
}