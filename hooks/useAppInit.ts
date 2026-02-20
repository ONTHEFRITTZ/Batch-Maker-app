// ============================================
// FILE: hooks/useAppInit.ts
// Offline-aware app initialization.
// Resolves quickly whether online or offline
// by racing a real session check against a
// timeout that falls back to cached session.
// ============================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { initializeDatabase } from '../services/database';
import { initializeReports } from '../services/reports';

export type InitState = 'loading' | 'online' | 'offline' | 'unauthenticated';

const SESSION_CACHE_KEY = '@cached_session_exists';
const INIT_TIMEOUT_MS = 3000; // max wait before falling back to offline mode

export function useAppInit(): { initState: InitState } {
  const [initState, setInitState] = useState<InitState>('loading');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Race: real session check vs timeout
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), INIT_TIMEOUT_MS)),
        ]);

        if (cancelled) return;

        // Timed out — check if we have a cached session indicator
        if (sessionResult === null) {
          const cachedExists = await AsyncStorage.getItem(SESSION_CACHE_KEY);
          if (cachedExists === 'true') {
            // User was previously logged in — let them use the app offline
            setInitState('offline');
          } else {
            setInitState('unauthenticated');
          }
          return;
        }

        const { data: { session } } = sessionResult as Awaited<ReturnType<typeof supabase.auth.getSession>>;

        if (!session) {
          await AsyncStorage.setItem(SESSION_CACHE_KEY, 'false');
          setInitState('unauthenticated');
          return;
        }

        // Authenticated and online
        await AsyncStorage.setItem(SESSION_CACHE_KEY, 'true');

        // Run background inits — don't block the UI state update on these
        Promise.all([
          initializeDatabase().catch(e => console.warn('[useAppInit] db init error:', e)),
          initializeReports().catch(e => console.warn('[useAppInit] reports init error:', e)),
        ]);

        if (!cancelled) setInitState('online');

      } catch (err) {
        if (cancelled) return;
        console.warn('[useAppInit] init error, checking cached session:', err);

        const cachedExists = await AsyncStorage.getItem(SESSION_CACHE_KEY);
        setInitState(cachedExists === 'true' ? 'offline' : 'unauthenticated');
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { initState };
}