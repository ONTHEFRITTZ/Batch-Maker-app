import { useEffect, useState, useRef } from 'react';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

export interface VoiceCommand {
  command: string;
  action: () => void;
  aliases?: string[];
}

interface VoiceCommandsOptions {
  wakeWord?: string; // e.g., "hey baker", "batch maker"
  continuousListening?: boolean; // Keep listening for wake word
  commandTimeout?: number; // Time to wait for command after wake word (ms)
}

export function useVoiceCommands(
  commands: VoiceCommand[],
  options: VoiceCommandsOptions = {}
) {
  const {
    wakeWord = 'hey baker',
    continuousListening = false,
    commandTimeout = 5000,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false); // True after wake word detected
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if spoken text contains wake word
  const containsWakeWord = (text: string): boolean => {
    return text.toLowerCase().includes(wakeWord.toLowerCase());
  };

  useEffect(() => {
    Voice.onSpeechStart = () => {
      setIsListening(true);
      setError(null);
    };

    Voice.onSpeechEnd = () => {
      setIsListening(false);
      
      // If continuous listening is enabled and not awake, restart listening
      if (continuousListening && !isAwake) {
        restartTimeoutRef.current = setTimeout(() => {
          startListening();
        }, 1000);
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setError(e.error?.message || 'Speech recognition error');
      setIsListening(false);
      
      // Restart if continuous listening
      if (continuousListening && !isAwake) {
        restartTimeoutRef.current = setTimeout(() => {
          startListening();
        }, 2000);
      }
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!e.value || e.value.length === 0) return;

      const spokenText = e.value[0].toLowerCase();
      setRecognizedText(spokenText);

      // Check for wake word first
      if (!isAwake && containsWakeWord(spokenText)) {
        console.log('🎤 Wake word detected!');
        setIsAwake(true);
        setRecognizedText(`Wake word detected! Say a command...`);
        
        // Start listening for actual command
        setTimeout(() => {
          startListening();
        }, 500);

        // Set timeout to reset awake state if no command given
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setIsAwake(false);
          setRecognizedText('');
          if (continuousListening) {
            startListening(); // Go back to listening for wake word
          }
        }, commandTimeout);

        return;
      }

      // If awake, process commands
      if (isAwake) {
        const matchedCommand = commands.find((cmd) => {
          const allPhrases = [cmd.command.toLowerCase(), ...(cmd.aliases || [])];
          return allPhrases.some((phrase) => spokenText.includes(phrase));
        });

        if (matchedCommand) {
          console.log('✅ Command matched:', matchedCommand.command);
          setRecognizedText(`Executing: ${matchedCommand.command}`);
          
          // Clear timeout
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          // Execute command
          setTimeout(() => {
            matchedCommand.action();
          }, 100);

          // Reset awake state
          setTimeout(() => {
            setIsAwake(false);
            setRecognizedText('');
            
            // Resume listening for wake word if continuous
            if (continuousListening) {
              setTimeout(() => startListening(), 1000);
            }
          }, 1500);
        } else {
          setError(`Command not recognized: "${spokenText}"`);
          
          // Reset and try again
          setTimeout(() => {
            setIsAwake(false);
            setError(null);
            setRecognizedText('');
            
            if (continuousListening) {
              startListening();
            }
          }, 2000);
        }
      }
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    };
  }, [commands, isAwake, wakeWord, continuousListening, commandTimeout]);

  const startListening = async () => {
    try {
      setError(null);
      await Voice.start('en-US');
    } catch (e: any) {
      setError(e.message || 'Failed to start listening');
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsAwake(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    } catch (e: any) {
      setError(e.message || 'Failed to stop listening');
    }
  };

  const reset = () => {
    setIsAwake(false);
    setRecognizedText('');
    setError(null);
    stopListening();
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