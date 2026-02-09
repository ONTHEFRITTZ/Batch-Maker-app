import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

/* -------------------------------------------------------------------------- */
/*                                TYPES                                       */
/* -------------------------------------------------------------------------- */

type SpeechPartialResults = {
  value?: string[];
};

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
/*                              GLOBAL MIC                                    */
/* -------------------------------------------------------------------------- */

let GLOBAL_MIC_ACTIVE = false;

/* -------------------------------------------------------------------------- */
/*                           ENV DETECTION                                    */
/* -------------------------------------------------------------------------- */

const isExpo =
  typeof (globalThis as any).expo !== 'undefined' ||
  typeof (globalThis as any).__expo !== 'undefined';

/* -------------------------------------------------------------------------- */
/*                              MAIN HOOK                                     */
/* -------------------------------------------------------------------------- */

export function useVoiceCommands(
  commands: VoiceCommand[],
  options: VoiceCommandsOptions = {}
) {
  const {
    wakeWord = 'hey baker',
    continuousListening = false,
    commandTimeout = 5000,
    confidenceThreshold = 0.55,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isListeningRef = useRef(false);
  const isAwakeRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const restartLockRef = useRef(false);

  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----------------------------- HELPERS ---------------------------------- */

  const normalize = (t: string) => t.toLowerCase().trim();

  const clearRef = (ref: React.MutableRefObject<any>) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const containsWakeWord = (text: string) =>
    normalize(text).includes(normalize(wakeWord));

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
        if (score > bestScore) {
          bestScore = score;
          bestCmd = cmd;
        }
      }
    }

    return bestScore >= confidenceThreshold ? bestCmd : null;
  };

  /* ----------------------------- WATCHDOG --------------------------------- */

  const startWatchdog = () => {
    clearRef(watchdogRef);
    watchdogRef.current = setTimeout(() => {
      if (
        continuousListening &&
        !isListeningRef.current &&
        !isAwakeRef.current
      ) {
        safeRestartListening();
      }
    }, 7000);
  };

  const stopWatchdog = () => clearRef(watchdogRef);

  /* --------------------------- SAFE RESTART -------------------------------- */

  const safeRestartListening = async (delay = 800) => {
    if (restartLockRef.current || GLOBAL_MIC_ACTIVE) return;

    restartLockRef.current = true;

    setTimeout(async () => {
      try {
        await Voice.destroy();
        GLOBAL_MIC_ACTIVE = false;
        await startListening();
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
      if (retry && continuousListening) startListening();
    }, 800);
  };

  const processCommand = (spoken: string) => {
    setRecognizedText(spoken);
    const cmd = findBestCommand(spoken);

    if (!cmd) {
      setError('Command not recognized');
      resetAwake(true);
      return;
    }

    cmd.action();
    resetAwake(false);
  };

  /* --------------------------- VOICE EVENTS -------------------------------- */

  useEffect(() => {
    Voice.onSpeechStart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
      if (Platform.OS === 'android') startWatchdog();
    };

    Voice.onSpeechEnd = () => {
      setIsListening(false);
      isListeningRef.current = false;
      stopWatchdog();

      if (continuousListening && !isAwakeRef.current) {
        clearRef(restartTimeoutRef);
        restartTimeoutRef.current = setTimeout(
          safeRestartListening,
          1000
        );
      }
    };

    Voice.onSpeechPartialResults = (e: SpeechPartialResults) => {
      if (e.value?.length) {
        setRecognizedText(normalize(e.value[0]));
      }
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!e.value?.length) return;
      const spoken = normalize(e.value[0]);

      if (!isAwakeRef.current && containsWakeWord(spoken)) {
        setIsAwake(true);
        isAwakeRef.current = true;
        setRecognizedText('Listening…');

        clearRef(commandTimeoutRef);

        const remainder = spoken
          .replace(normalize(wakeWord), '')
          .trim();

        if (remainder) processCommand(remainder);
        else {
          commandTimeoutRef.current = setTimeout(
            () => resetAwake(true),
            commandTimeout
          );
        }
        return;
      }

      if (isAwakeRef.current) processCommand(spoken);
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setError(e.error?.message || 'Speech error');
      isListeningRef.current = false;
      stopWatchdog();
      if (continuousListening && !isAwakeRef.current) {
        safeRestartListening(1500);
      }
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      stopWatchdog();
      clearRef(commandTimeoutRef);
      clearRef(restartTimeoutRef);
      GLOBAL_MIC_ACTIVE = false;
    };
  }, [commands, continuousListening, commandTimeout]);

  /* ---------------------------- APP STATE ---------------------------------- */

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (
        prev.match(/inactive|background/) &&
        next === 'active' &&
        continuousListening
      ) {
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
      GLOBAL_MIC_ACTIVE = true;
      await Voice.start('en-US');
    } catch {
      GLOBAL_MIC_ACTIVE = false;
      if (Platform.OS === 'android') safeRestartListening(1200);
    }
  };

  const stopListening = async () => {
    clearRef(commandTimeoutRef);
    clearRef(restartTimeoutRef);
    stopWatchdog();

    setIsAwake(false);
    isAwakeRef.current = false;

    try {
      await Voice.stop();
    } finally {
      GLOBAL_MIC_ACTIVE = false;
    }
  };

  const reset = () => {
    stopListening();
    setRecognizedText('');
    setError(null);
  };

  return {
    isListening,
    isAwake,
    recognizedText,
    error,
    startListening,
    stopListening,
    reset,
    wakeWord,
  };
}
