import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

/* -------------------------------------------------------------------------- */
/*                                TYPES                                       */
/* -------------------------------------------------------------------------- */

export interface VoiceCommand {
  command: string;
  action: () => void;
  aliases?: string[];
}

interface VoiceCommandsOptions {
  wakeWord?: string;
  continuousListening?: boolean;
  commandTimeout?: number;
  confidenceThreshold?: number;
}

/* -------------------------------------------------------------------------- */
/*  GLOBAL FLAG — prevents two instances starting at once                     */
/* -------------------------------------------------------------------------- */

let GLOBAL_MIC_ACTIVE = false;

/* -------------------------------------------------------------------------- */
/*                              MAIN HOOK                                     */
/* -------------------------------------------------------------------------- */

export function useVoiceCommands(
  commands: VoiceCommand[],
  options: VoiceCommandsOptions = {}
) {
  const {
    wakeWord = null,
    continuousListening = true,
    commandTimeout = 5000,
    confidenceThreshold = 0.55,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isListeningRef   = useRef(false);
  const isAwakeRef       = useRef(false);
  const appStateRef      = useRef<AppStateStatus>(AppState.currentState);
  const restartLockRef   = useRef(false);

  /*
   * shouldRestartRef is the single source of truth for whether auto-restart
   * is permitted.  It is set to TRUE only inside startListening() and FALSE
   * as the very FIRST thing in stopListening() — before any async work —
   * so that any restart callbacks queued after that point will bail out.
   */
  const shouldRestartRef = useRef(false);

  const commandTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----------------------------- HELPERS ---------------------------------- */

  const normalize = (t: string) => t.toLowerCase().trim();

  const clearRef = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) { clearTimeout(ref.current); ref.current = null; }
  };

  const containsWakeWord = (text: string) =>
    wakeWord ? normalize(text).includes(normalize(wakeWord)) : true;

  /* ------------------------ CONFIDENCE MATCHING --------------------------- */

  const similarity = (a: string, b: string) => {
    const A = normalize(a).split(' ');
    const B = normalize(b).split(' ');
    const matches = A.filter(w => B.includes(w)).length;
    return matches / Math.max(A.length, B.length);
  };

  const findBestCommand = (spoken: string) => {
    let bestScore = 0;
    let bestCmd: VoiceCommand | null = null;
    for (const cmd of commands) {
      for (const phrase of [cmd.command, ...(cmd.aliases || [])]) {
        const score = similarity(spoken, phrase);
        if (score > bestScore) { bestScore = score; bestCmd = cmd; }
      }
    }
    return bestScore >= confidenceThreshold ? bestCmd : null;
  };

  /* ----------------------------- WATCHDOG --------------------------------- */

  const startWatchdog = () => {
    clearRef(watchdogRef);
    watchdogRef.current = setTimeout(() => {
      // Guard checked inside the callback — not at schedule time
      if (continuousListening && shouldRestartRef.current && !isListeningRef.current && !isAwakeRef.current) {
        safeRestartListening();
      }
    }, 7000);
  };

  const stopWatchdog = () => clearRef(watchdogRef);

  /* --------------------------- SAFE RESTART -------------------------------- */

  const safeRestartListening = async (delay = 800) => {
    // Guard checked here — not at call site, so a stale closure can't bypass it
    if (restartLockRef.current || GLOBAL_MIC_ACTIVE || !shouldRestartRef.current) return;

    restartLockRef.current = true;
    clearRef(safeRestartTimeoutRef);

    safeRestartTimeoutRef.current = setTimeout(async () => {
      try {
        // Final guard — in case stopListening() was called during the delay
        if (!shouldRestartRef.current) {
          restartLockRef.current = false;
          return;
        }
        ExpoSpeechRecognitionModule.stop();
        GLOBAL_MIC_ACTIVE = false;
        if (shouldRestartRef.current) {
          await startListening();
        }
      } catch (err) {
        console.error('Failed to restart listening:', err);
        GLOBAL_MIC_ACTIVE = false;
      } finally {
        restartLockRef.current = false;
      }
    }, delay);
  };

  /* --------------------------- COMMAND FLOW -------------------------------- */

  const resetAwake = (retry: boolean) => {
    clearRef(commandTimeoutRef);
    setIsAwake(false);
    isAwakeRef.current = false;
    setTimeout(() => {
      setRecognizedText('');
      setError(null);
      // Guard checked at execution time — stale closure-safe
      if (retry && shouldRestartRef.current) safeRestartListening(500);
    }, 800);
  };

  const processCommand = (spoken: string) => {
    setRecognizedText(spoken);
    const cmd = findBestCommand(spoken);
    if (!cmd) { setError('Command not recognized'); resetAwake(true); return; }
    try { cmd.action(); resetAwake(true); }
    catch (err) { console.error('Error executing command:', err); setError('Command failed'); resetAwake(true); }
  };

  /* --------------------------- VOICE EVENTS -------------------------------- */

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    isListeningRef.current = true;
    setError(null);
    if (Platform.OS === 'android') startWatchdog();
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    isListeningRef.current = false;
    stopWatchdog();

    /*
     * Key fix: schedule the restart but check shouldRestartRef INSIDE the
     * timeout callback.  The original code checked it at schedule time;
     * by the time the timeout fired the flag was still true because
     * stopListening()'s async stop() hadn't finished yet.
     */
    if (continuousListening && !isAwakeRef.current) {
      clearRef(restartTimeoutRef);
      restartTimeoutRef.current = setTimeout(() => {
        if (shouldRestartRef.current) safeRestartListening();
      }, 1000);
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.results || event.results.length === 0) return;
    const transcripts = event.results.map((r: any) => r.transcript);
    if (transcripts.length === 0) return;
    const spoken = normalize(transcripts[0]);

    if (!event.isFinal) { setRecognizedText(spoken); return; }

    if (wakeWord && !isAwakeRef.current && containsWakeWord(spoken)) {
      setIsAwake(true);
      isAwakeRef.current = true;
      setRecognizedText('Listening…');
      clearRef(commandTimeoutRef);
      const remainder = spoken.replace(normalize(wakeWord!), '').trim();
      if (remainder) processCommand(remainder);
      else { commandTimeoutRef.current = setTimeout(() => resetAwake(true), commandTimeout); }
      return;
    }

    processCommand(spoken);
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    setError(event.error || 'Speech error');
    setIsListening(false);
    isListeningRef.current = false;
    GLOBAL_MIC_ACTIVE = false;
    stopWatchdog();
    // Same pattern: check inside callback, not at schedule time
    if (continuousListening && !isAwakeRef.current) {
      setTimeout(() => {
        if (shouldRestartRef.current) safeRestartListening(1500);
      }, 0);
    }
  });

  /* ---------------------------- CLEANUP ------------------------------------ */

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
      stopWatchdog();
      clearRef(commandTimeoutRef);
      clearRef(restartTimeoutRef);
      clearRef(safeRestartTimeoutRef);
      GLOBAL_MIC_ACTIVE = false;
    };
  }, []);

  /* ---------------------------- APP STATE ---------------------------------- */

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active' && continuousListening) {
        // Guard checked inside safeRestartListening
        safeRestartListening(500);
      }
      if (next !== 'active') stopWatchdog();
    });
    return () => sub.remove();
  }, [continuousListening]);

  /* ---------------------------- CONTROLS ---------------------------------- */

  const startListening = async () => {
    if (isListeningRef.current || GLOBAL_MIC_ACTIVE) return;
    try {
      // Set to true ONLY here — this is the gate
      shouldRestartRef.current = true;

      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission denied');
        shouldRestartRef.current = false;
        return;
      }

      GLOBAL_MIC_ACTIVE = true;
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: continuousListening,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        contextualStrings: wakeWord
          ? [wakeWord, ...commands.map(c => c.command)]
          : commands.map(c => c.command),
      });
    } catch (err) {
      console.error('Failed to start listening:', err);
      GLOBAL_MIC_ACTIVE = false;
      shouldRestartRef.current = false;
      setError('Failed to start voice recognition');
      if (Platform.OS === 'android') {
        setTimeout(() => { if (shouldRestartRef.current) safeRestartListening(1200); }, 0);
      }
    }
  };

  const stopListening = async () => {
    /*
     * Set to false FIRST — synchronously, before any async work.
     * This ensures every pending timeout callback that checks
     * shouldRestartRef.current will see false and bail out,
     * even if they were already queued.
     */
    shouldRestartRef.current = false;

    // Cancel all pending restart timers immediately
    clearRef(commandTimeoutRef);
    clearRef(restartTimeoutRef);
    clearRef(safeRestartTimeoutRef);
    stopWatchdog();

    // Reset state
    setIsAwake(false);
    isAwakeRef.current = false;
    setIsListening(false);
    isListeningRef.current = false;
    restartLockRef.current = false;

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.error('Failed to stop listening:', err);
    } finally {
      GLOBAL_MIC_ACTIVE = false;
    }
  };

  const reset = () => {
    stopListening();
    setRecognizedText('');
    setError(null);
  };

  return { isListening, isAwake, recognizedText, error, startListening, stopListening, reset, wakeWord };
}