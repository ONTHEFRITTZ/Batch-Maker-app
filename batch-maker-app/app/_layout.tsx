import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import CustomHeader from './components/CustomHeader';
import { initializeDatabase } from '../services/database';
import { initializeReports } from '../services/reports';
import { initializePhotoStorage } from '../services/photoStorage';
import { syncService } from '../services/sync';
import { ThemeProvider } from '../contexts/ThemeContext';

// Global deep link listener
Linking.addEventListener('url', (event) => {
  console.log('🔗 GLOBAL deep link listener:', event.url);
});

// Configure which files Expo Router should ignore
export const unstable_settings = {
  // Ensure any route can show the initial URL
  initialRouteName: 'index',
};

export default function Layout() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing app...');
        await initializeDatabase();
        console.log('✅ Database initialized');
        
        await initializeReports();
        console.log('✅ Reports initialized');
        
        await initializePhotoStorage();
        console.log('✅ Photo storage initialized');
        
        await syncService.initialize();
        console.log('✅ Sync service initialized');
      } catch (error) {
        console.error('❌ Error initializing app:', error);
      }
    };
    initializeApp();
  }, []);
  
  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          header: ({ navigation }) => (
            <CustomHeader canGoBack={navigation.canGoBack()} />
          ),
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="callback" 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="screens/WorkflowSelectScreen"
          options={{ headerShown: true }}
        />
        <Stack.Screen 
          name="screens/StepScreen"
          options={{ headerShown: true }}
        />
        <Stack.Screen 
          name="screens/WorkflowBuilderScreen"
          options={{ 
            headerShown: true,
            title: 'Create Workflow'
          }}
        />
        <Stack.Screen 
          name="screens/RecipeParserScreen"
          options={{ 
            headerShown: true,
            title: 'Import Recipe'
          }}
        />
        <Stack.Screen 
          name="screens/WorkflowEditorScreen"
          options={{ 
            headerShown: true,
            title: 'Edit Workflow'
          }}
        />
        <Stack.Screen 
          name="screens/ReportsScreen"
          options={{ 
            headerShown: true,
            title: 'Reports'
          }}
        />
        <Stack.Screen 
          name="screens/EnvironmentalReportScreen"
          options={{ 
            headerShown: true,
            title: 'Environmental Report'
          }}
        />
        <Stack.Screen 
          name="screens/URLImportScreen"
          options={{ 
            headerShown: true,
            title: 'Import from URL'
          }}
        />
        <Stack.Screen 
          name="screens/NetworkScanScreen"
          options={{ 
            headerShown: true,
            title: 'Multi-Device Sync'
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}