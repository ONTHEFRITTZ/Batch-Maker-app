// ============================================
// FILE: app/components/BatchTimer.tsx
// Enhanced with ref support for voice commands
// ============================================

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { 
  getBatch, startTimer, stopTimer, getTimerStatus, 
  Timer 
} from '../../services/database';
import { useTheme } from '../../contexts/ThemeContext';

export interface BatchTimerRef {
  startPause: () => void;
  reset: () => void;
  addMinute: () => void;
}

interface BatchTimerProps {
  batchId: string;
  stepId: string;
  durationMinutes: number;
}

const BatchTimer = forwardRef<BatchTimerRef, BatchTimerProps>(({ batchId, stepId, durationMinutes }, ref) => {
  const { colors } = useTheme();
  const [currentTimer, setCurrentTimer] = useState<Timer | null>(null);
  const [timeDisplay, setTimeDisplay] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const batch = getBatch(batchId);
      if (!batch) return;

      const timer = batch.activeTimers.find(t => t.stepId === stepId);
      setCurrentTimer(timer || null);

      if (timer) {
        const status = getTimerStatus(timer);
        setTimeDisplay(formatTime(status.remainingSeconds));
        setIsExpired(status.isExpired);
      } else {
        setTimeDisplay(formatTime(durationMinutes * 60));
        setIsExpired(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [batchId, stepId, durationMinutes]);

  const handleStart = async () => {
    await startTimer(batchId, stepId, durationMinutes);
  };

  const handleStop = async () => {
    if (currentTimer) {
      await stopTimer(batchId, currentTimer.id);
    }
  };

  const handleStartPause = async () => {
    if (isRunning) {
      await handleStop();
    } else {
      await handleStart();
    }
  };

  const handleReset = async () => {
    if (currentTimer) {
      await stopTimer(batchId, currentTimer.id);
    }
  };

  const handleAddMinute = async () => {
    // Stop current timer if running
    if (currentTimer) {
      await stopTimer(batchId, currentTimer.id);
    }
    // Start new timer with extra minute
    await startTimer(batchId, stepId, durationMinutes + 1);
  };

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRunning = currentTimer !== null;
  const progress = currentTimer 
    ? Math.max(0, Math.min(100, (getTimerStatus(currentTimer).remainingSeconds / (durationMinutes * 60)) * 100))
    : 100;

  // Expose methods to parent component via ref for voice commands
  useImperativeHandle(ref, () => ({
    startPause: handleStartPause,
    reset: handleReset,
    addMinute: handleAddMinute,
  }));

  return (
    <View style={styles.container}>
      {/* Timer display */}
      <View style={styles.timerDisplay}>
        <Text style={[
          styles.timerText,
          { color: colors.text },
          isExpired && { color: colors.error }
        ]}>
          {timeDisplay}
        </Text>
        <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>
          {isExpired ? '⚠️ Expired!' : isRunning ? 'Running...' : 'Ready'}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${progress}%`,
              backgroundColor: isExpired ? colors.error : isRunning ? colors.primary : colors.success
            }
          ]} 
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isRunning ? (
          <TouchableOpacity 
            onPress={handleStart}
            style={[styles.button, styles.startButton, { backgroundColor: colors.success }]}
          >
            <Text style={styles.buttonText}>▶ Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={handleStop}
            style={[styles.button, styles.pauseButton, { backgroundColor: colors.warning }]}
          >
            <Text style={styles.buttonText}>⏸ Pause</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={handleAddMinute}
          style={[styles.button, styles.addMinuteButton, { backgroundColor: colors.primary }]}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>+1 Min</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleReset}
          style={[styles.button, styles.resetButton, { backgroundColor: colors.textSecondary }]}
        >
          <Text style={styles.buttonText}>↻ Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {},
  pauseButton: {},
  addMinuteButton: {},
  resetButton: {},
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BatchTimer;