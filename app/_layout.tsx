// ============================================
// FILE: app/_layout.tsx
// Added ClockInScreen to Stack navigator.
// Removed broken syncService import.
// ============================================

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import CustomHeader from './components/CustomHeader';
import { syncFromServer } from '../services/database';
import { initializeReports } from '../services/reports';
import { flushOfflineQueue } from '../services/offlineQueue';
// initializeDatabase is called via useAppInit in the index screen
// _layout only handles foreground sync flush
import { ThemeProvider } from '../contexts/ThemeContext';

// Global deep link listener
Linking.addEventListener('url', (event) => {
  console.log('GLOBAL deep link listener:', event.url);
});

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function Layout() {
  useEffect(() => {
    // Re-flush queue whenever app returns to foreground
    // (init is handled by useAppInit in the index screen)
    initializeReports().catch(() => {});
    const { AppState } = require('react-native');
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'active') flushOfflineQueue().catch(() => {});
    });

    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          header: ({ navigation }: any) => (
            <CustomHeader canGoBack={navigation.canGoBack()} />
          ),
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="callback" options={{ headerShown: false }} />

        <Stack.Screen
          name="screens/WorkflowSelectScreen"
          options={{ headerShown: true }}
        />

        <Stack.Screen
          name="screens/StepScreen"
          options={{ headerShown: true }}
        />

        <Stack.Screen
          name="screens/ClockInScreen"
          options={{ headerShown: true, title: 'Clock In / Out' }}
        />

        <Stack.Screen
          name="screens/WorkflowBuilderScreen"
          options={{ headerShown: true, title: 'Create Workflow' }}
        />

        <Stack.Screen
          name="screens/RecipeParserScreen"
          options={{ headerShown: true, title: 'Import Recipe' }}
        />

        <Stack.Screen
          name="screens/WorkflowEditorScreen"
          options={{ headerShown: true, title: 'Edit Workflow' }}
        />

        <Stack.Screen
          name="screens/ReportsScreen"
          options={{ headerShown: true, title: 'Reports' }}
        />

        <Stack.Screen
          name="screens/EnvironmentalReportScreen"
          options={{ headerShown: true, title: 'Environmental Report' }}
        />

        <Stack.Screen
          name="screens/URLImportScreen"
          options={{ headerShown: true, title: 'Import from URL' }}
        />
      </Stack>
    </ThemeProvider>
  );
}