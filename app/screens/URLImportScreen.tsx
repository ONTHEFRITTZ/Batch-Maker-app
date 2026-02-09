import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { addWorkflow, Workflow } from '../../services/database';
import { supabase } from '../../services/supabaseClient';

export default function URLImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    if (!url.match(/^https?:\/\/.+/i)) {
      Alert.alert('Error', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);

    try {
      console.log('🔍 Calling parse-recipe-url edge function...');
      
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        Alert.alert('Error', 'You must be signed in to import recipes');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('parse-recipe-url', {
        body: { url }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Failed to parse recipe');
      }

      if (data.error) {
        console.error('❌ Parser error:', data.error);
        
        if (data.error === 'NOT_A_RECIPE') {
          Alert.alert('Not a Recipe', 'This URL does not appear to contain a recipe.');
        } else if (data.error === 'API_FAILURE') {
          Alert.alert('Error', 'AI service error. Please try again.');
        } else {
          Alert.alert('Error', data.message || 'Failed to parse recipe');
        }
        
        setLoading(false);
        return;
      }

      if (!data.success || !data.workflow) {
        throw new Error('Invalid response from server');
      }

      const workflow = data.workflow;

      console.log('✅ Workflow received:', workflow.name);
      console.log('📊 Steps:', workflow.steps.length);

      // Create workflow in local database
      const workflowId = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now();

      const workflowSteps = workflow.steps.map((step: any, index: number) => ({
        id: `${workflowId}_step_${step.order || index}`,
        title: step.title || `Step ${step.order || index}`,
        description: step.description || '',
        timerMinutes: step.duration_minutes || undefined,
        completed: false,
        ingredients: step.ingredients || [],
      }));

      const finalWorkflow: Workflow = {
        id: workflowId,
        name: workflow.name,
        steps: workflowSteps,
      };

      await addWorkflow(finalWorkflow);

      Alert.alert(
        '✅ Success!',
        `Imported "${workflow.name}"\n\n📊 ${workflow.steps.length} steps (including prep)`,
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error: any) {
      console.error('❌ Import error:', error);
      
      let errorMessage = 'Failed to import recipe';
      if (error.message.includes('Network')) {
        errorMessage = 'Network error. Check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Import from URL</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Paste any recipe URL and our AI will extract everything automatically
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Recipe URL *</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border
            }]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.allrecipes.com/recipe/..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />
        </View>

        <View style={[styles.infoBox, {
          backgroundColor: colors.primary + '15',
          borderColor: colors.primary
        }]}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>🤖 AI-Powered Import</Text>
          <Text style={[styles.infoText, { color: colors.text }]}>
            • Uses Claude AI to parse any recipe format{'\n'}
            • Auto-creates "Prepare Ingredients" step{'\n'}
            • Matches ingredients to each step{'\n'}
            • Extracts timers and temperatures{'\n'}
            • Works with 95%+ of recipe sites
          </Text>
        </View>

        <View style={[styles.exampleBox, {
          backgroundColor: colors.surfaceVariant,
          borderColor: colors.border
        }]}>
          <Text style={[styles.exampleTitle, { color: colors.text }]}>✅ Tested Sites:</Text>
          <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
            AllRecipes • Food Network • Bon Appétit{'\n'}
            Serious Eats • RecipeTin Eats • Budget Bytes{'\n'}
            Sally's Baking • NYT Cooking • Tasty{'\n'}
            Delish • Epicurious • Simply Recipes{'\n'}
            Most WordPress/Blogger recipe sites
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, {
        backgroundColor: colors.surface,
        borderTopColor: colors.border
      }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.surfaceVariant }]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.importButton, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
          onPress={handleImport}
          disabled={loading}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.importButtonText}>Importing...</Text>
            </View>
          ) : (
            <Text style={styles.importButtonText}>Import Recipe</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32, lineHeight: 22 },
  section: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  infoBox: { borderWidth: 2, borderRadius: 12, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  infoText: { fontSize: 14, lineHeight: 22 },
  exampleBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  exampleTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  exampleText: { fontSize: 13, lineHeight: 20 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  importButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  importButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});