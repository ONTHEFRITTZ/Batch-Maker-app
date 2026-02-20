// ============================================
// FILE: app/components/SyncStatusBar.tsx
// Displays a slim banner when the app is
// offline, checking, or has pending writes.
// Fades out automatically when all clear.
// ============================================

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConnectionStatus } from '../../hooks/useConnectionStatus';

interface Props {
  connection: ConnectionStatus;
}

export function SyncStatusBar({ connection }: Props) {
  const { state, pendingCount, manualRetry } = connection;

  // Only show when something needs attention
  const visible =
    state === 'offline' ||
    state === 'checking' ||
    pendingCount > 0;

  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible && opacity.__getValue() === 0) return null;

  const bgColor =
    state === 'offline'  ? '#ef4444' :
    state === 'checking' ? '#f59e0b' :
    pendingCount > 0     ? '#f59e0b' :
                           '#10b981';

  const message =
    state === 'offline'
      ? '● No internet connection'
      : state === 'checking'
      ? '○ Connecting…'
      : `↑ ${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending sync`;

  return (
    <Animated.View style={[styles.bar, { backgroundColor: bgColor, opacity }]}>
      <Text style={styles.text}>{message}</Text>
      {state === 'offline' && (
        <TouchableOpacity onPress={manualRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    // Positioned lower so it doesn't clash with notch/Dynamic Island
    top: 100,
    left: 16,
    right: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
    zIndex: 100,
    // Shadow so it floats above content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  retryBtn: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});