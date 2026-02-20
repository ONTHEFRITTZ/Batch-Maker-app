// ============================================
// FILE: app/_layout.tsx
// Root layout. Removed all deprecated imports
// (syncService, cloudSync, initializeDatabase).
// Init is handled by useAppInit in index.tsx.
// Layout only handles foreground queue flush.
// ============================================

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import CustomHeader from './components/CustomHeader';
import { initializeReports } from '../services/reports';
import { flushOfflineQueue } from '../services/offlineQueue';
import { ThemeProvider } from '../contexts/ThemeContext';

// Global deep link listener (logs only — actual handling is in index.tsx)
Linking.addEventListener('url', (event) => {
  console.log('GLOBAL deep link:', event.url);
});

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function Layout() {
  useEffect(() => {
    // Run lightweight background inits that don't block the UI
    initializeReports().catch(() => {});

    // Flush any queued offline writes whenever the app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        flushOfflineQueue().catch(() => {});
      }
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