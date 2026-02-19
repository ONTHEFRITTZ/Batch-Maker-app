// ============================================
// FILE: components/SyncStatusBar.tsx
//
// Shown only on HomeScreen. Displays:
//   - Online + synced: nothing (hidden)
//   - Online + pending ops: "Syncing X changes..."
//   - Offline: "Offline · Tap to retry"
//   - Checking: "Checking connection..."
//
// Stays out of the way when everything is fine.
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ConnectionStatus } from '../../hooks/useConnectionStatus';

interface Props {
  connection: ConnectionStatus;
}

export function SyncStatusBar({ connection }: Props) {
  const { state, pendingCount, lastSyncedAt, manualRetry } = connection;
  const opacity = useRef(new Animated.Value(0)).current;

  const isVisible =
    state === 'offline' ||
    state === 'checking' ||
    (state === 'online' && pendingCount > 0);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  if (!isVisible && opacity._value === 0) return null;

  const barColor =
    state === 'offline'  ? '#7C3030' :
    state === 'checking' ? '#4A4A2E' :
    '#1E3A1E'; // syncing — muted green

  const label =
    state === 'offline'  ? 'Offline  ·  Changes saved locally' :
    state === 'checking' ? 'Checking connection…' :
    pendingCount === 1   ? 'Syncing 1 change…' :
                           `Syncing ${pendingCount} changes…`;

  return (
    <Animated.View style={[styles.bar, { backgroundColor: barColor, opacity }]}>
      {state === 'checking' && (
        <ActivityIndicator size="small" color="#AAA" style={styles.spinner} />
      )}
      {state === 'online' && pendingCount > 0 && (
        <ActivityIndicator size="small" color="#AAA" style={styles.spinner} />
      )}
      <Text style={styles.label}>{label}</Text>
      {state === 'offline' && (
        <TouchableOpacity onPress={manualRetry} style={styles.retryButton} activeOpacity={0.7}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 8,
  },
  spinner: {
    marginRight: 4,
  },
  label: {
    fontSize: 12,
    color: '#CCC',
    letterSpacing: 0.2,
  },
  retryButton: {
    marginLeft: 8,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#888',
  },
  retryText: {
    fontSize: 11,
    color: '#CCC',
    fontWeight: '600',
  },
});