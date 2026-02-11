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
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    if (!trimmedUrl.match(/^https?:\/\/.+/i)) {
      Alert.alert('Error', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        Alert.alert('Error', 'You must be signed in to import recipes');
        return;
      }

      const accessToken = sessionData.session.access_token;

      console.log('Calling parse-recipe-url...');

      const { data, error } = await supabase.functions.invoke('parse-recipe-url', {
        body: { url: trimmedUrl },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to parse recipe');
      }

      if (!data) {
        throw new Error('No response from server');
      }

      if (data.error) {
        console.error('Parser returned error:', data.error, data.message);

        if (data.error === 'NOT_A_RECIPE') {
          Alert.alert('Not a Recipe', 'This URL does not appear to contain a recipe.');
        } else if (data.error === 'UNAUTHORIZED') {
          Alert.alert('Session Expired', 'Please sign out and sign back in.');
        } else if (data.error === 'API_FAILURE') {
          Alert.alert('Error', 'AI service error. Please try again.');
        } else if (data.error === 'FETCH_FAILED') {
          Alert.alert('Error', 'Could not load that page. Check the URL and try again.');
        } else {
          Alert.alert('Error', data.message || 'Failed to parse recipe');
        }

        return;
      }

      if (!data.success || !data.workflow) {
        throw new Error('Invalid response from server');
      }

      const workflow = data.workflow;

      console.log('Workflow received:', workflow.name);
      console.log('Steps:', workflow.steps.length);

      const workflowId =
        workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now();

      const workflowSteps = workflow.steps.map((step: any, index: number) => ({
        id: `${workflowId}_step_${step.order ?? index}`,
        title: step.title || `Step ${step.order ?? index + 1}`,
        description: step.description || '',
        timerMinutes: step.duration_minutes ?? undefined,
        completed: false,
        ingredients: step.ingredients_for_step || [],
      }));

      const finalWorkflow: Workflow = {
        id: workflowId,
        name: workflow.name,
        steps: workflowSteps,
      };

      await addWorkflow(finalWorkflow);

      // step 0 is "Prepare Ingredients" — don't count it in the user-facing total
      const recipeStepCount = workflow.steps.filter((s: any) => s.order !== 0).length;

      Alert.alert(
        'Recipe Imported',
        `"${workflow.name}" (${recipeStepCount} steps)`,
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error: any) {
      console.error('Import error:', error);

      let message = 'Failed to import recipe';

      if (error.message?.toLowerCase().includes('network')) {
        message = 'Network error. Check your internet connection.';
      } else if (error.message?.includes('401')) {
        message = 'Authentication error. Please sign in again.';
      } else if (error.message) {
        message = error.message;
      }

      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Import from URL</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Paste any recipe URL and AI will extract the steps automatically.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Recipe URL</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.example.com/recipe/..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />
        </View>

        <View
          style={[
            styles.infoBox,
            { backgroundColor: colors.primary + '15', borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.primary }]}>How it works</Text>
          <Text style={[styles.infoText, { color: colors.text }]}>
            Step 1 is always "Prepare Ingredients".{'\n'}
            Each step lists only what you need for that step.{'\n'}
            Timers are extracted for baking and resting steps.{'\n'}
            Works with most major recipe sites.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.surfaceVariant }]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.importButton,
            { backgroundColor: colors.primary },
            loading && styles.disabledButton,
          ]}
          onPress={handleImport}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
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
  content: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32, lineHeight: 22 },
  section: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  infoBox: { borderWidth: 2, borderRadius: 12, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  infoText: { fontSize: 14, lineHeight: 22 },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  importButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  importButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});