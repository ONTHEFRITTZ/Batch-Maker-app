import React, { useState, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';

interface TimerProps {
    minutes: number;
    onFinish: () => void;
}

export default function Timer({ minutes, onFinish }: TimerProps) {
    const totalSeconds = minutes * 60;
    const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef<any>(null); // Changed from NodeJS.Timeout to any

    useEffect(() => {
        if (isRunning && secondsLeft > 0) {
            intervalRef.current = setInterval(() => {
                setSecondsLeft(prev => {
                    if (prev <= 1) {
                        setIsRunning(false);
                        onFinish();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, secondsLeft]);

    useEffect(() => {
        setSecondsLeft(totalSeconds);
        setIsRunning(false);
    }, [totalSeconds]);

    const handleStartPause = () => {
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        setSecondsLeft(totalSeconds);
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = (secondsLeft / totalSeconds) * 100;

    return (
        <View style={styles.container}>
            <View style={styles.timerDisplay}>
                <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
                <Text style={styles.timerLabel}>
                    {secondsLeft === 0 ? 'Complete!' : isRunning ? 'Running...' : 'Paused'}
                </Text>
            </View>

            <View style={styles.progressBarContainer}>
                <View 
                    style={[
                        styles.progressBar, 
                        { 
                            width: `${progress}%`,
                            backgroundColor: secondsLeft === 0 ? '#28a745' : isRunning ? '#007AFF' : '#ffc107'
                        }
                    ]} 
                />
            </View>

            <View style={styles.controls}>
                <TouchableOpacity 
                    onPress={handleStartPause}
                    style={[styles.button, isRunning ? styles.pauseButton : styles.startButton]}
                    disabled={secondsLeft === 0}
                >
                    <Text style={styles.buttonText}>
                        {isRunning ? '⏸ Pause' : secondsLeft === 0 ? '✓ Done' : '▶ Start'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={handleReset}
                    style={[styles.button, styles.resetButton]}
                >
                    <Text style={styles.buttonText}>↻ Reset</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

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
        color: '#333',
        fontVariant: ['tabular-nums'],
    },
    timerLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: '#e0e0e0',
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
        gap: 12,
    },
    button: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    startButton: {
        backgroundColor: '#28a745',
    },
    pauseButton: {
        backgroundColor: '#ffc107',
    },
    resetButton: {
        backgroundColor: '#6c757d',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});