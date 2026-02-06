import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { addWorkflow, getWorkflows, Workflow, Step } from '../../services/database';

interface ChecklistItem {
  text: string;
}

interface StepWithExtras extends Partial<Step> {
  checklistItems?: ChecklistItem[];
  youtubeUrl?: string;
}

export default function WorkflowBuilderScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [workflowName, setWorkflowName] = useState('');
  const [steps, setSteps] = useState<StepWithExtras[]>([{
    title: '',
    description: '',
    timerMinutes: undefined,
    checklistItems: [],
    youtubeUrl: undefined,
  }]);
  const [isSaving, setIsSaving] = useState(false);

  const addStep = () => {
    setSteps([...steps, {
      title: '',
      description: '',
      timerMinutes: undefined,
      checklistItems: [],
      youtubeUrl: undefined,
    }]);
  };

  const removeStep = (index: number) => {
    if (steps.length === 1) {
      Alert.alert('Error', 'Workflow must have at least one step');
      return;
    }
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof StepWithExtras, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const addChecklistItem = (stepIndex: number) => {
    const newSteps = [...steps];
    if (!newSteps[stepIndex].checklistItems) {
      newSteps[stepIndex].checklistItems = [];
    }
    newSteps[stepIndex].checklistItems!.push({ text: '' });
    setSteps(newSteps);
  };

  const updateChecklistItem = (stepIndex: number, itemIndex: number, text: string) => {
    const newSteps = [...steps];
    newSteps[stepIndex].checklistItems![itemIndex].text = text;
    setSteps(newSteps);
  };

  const removeChecklistItem = (stepIndex: number, itemIndex: number) => {
    const newSteps = [...steps];
    newSteps[stepIndex].checklistItems = newSteps[stepIndex].checklistItems!.filter((_, i) => i !== itemIndex);
    setSteps(newSteps);
  };

  const saveWorkflow = async () => {
    try {
      setIsSaving(true);

      if (!workflowName.trim()) {
        Alert.alert('Error', 'Please enter a workflow name');
        setIsSaving(false);
        return;
      }

      const emptySteps = steps.filter(s => !s.title?.trim());
      if (emptySteps.length > 0) {
        Alert.alert('Error', 'All steps must have a title');
        setIsSaving(false);
        return;
      }

      const workflowId = workflowName.toLowerCase().replace(/\s+/g, '_') + '_custom_' + Date.now();
      
      // Process steps
      const processedSteps: Step[] = [];

      for (let index = 0; index < steps.length; index++) {
        const step = steps[index];
        let description = step.description || '';
        
        // Add checklist
        if (step.checklistItems && step.checklistItems.length > 0) {
          const checklistText = step.checklistItems
            .filter(item => item.text.trim())
            .map(item => `☐ ${item.text}`)
            .join('\n');
          
          if (checklistText) {
            if (description) description += '\n\n';
            description += `📋 Checklist:\n${checklistText}`;
          }
        }

        // Add YouTube URL
        if (step.youtubeUrl && step.youtubeUrl.trim()) {
          if (description) description += '\n\n';
          description += `🎥 Video: ${step.youtubeUrl.trim()}`;
        }

        processedSteps.push({
          id: `${workflowId}_step_${index + 1}`,
          title: step.title || '',
          description,
          timerMinutes: step.timerMinutes,
          completed: false,
        });
      }

      const newWorkflow: Workflow = {
        id: workflowId,
        name: workflowName,
        steps: processedSteps,
      };

      const existingCount = getWorkflows().length;
      await addWorkflow(newWorkflow);
      const newCount = getWorkflows().length;

      if (newCount === existingCount) {
        Alert.alert('Error', 'Failed to save workflow');
        setIsSaving(false);
        return;
      }

      const savedWorkflow = getWorkflows().find(w => w.id === workflowId);
      if (!savedWorkflow) {
        Alert.alert('Error', 'Failed to save workflow');
        setIsSaving(false);
        return;
      }

      Alert.alert(
        'Success', 
        `Custom workflow "${newWorkflow.name}" created!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving workflow:', error);
      Alert.alert('Error', `Failed to save workflow: ${error}`);
      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Workflow Name */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Workflow Name</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.surface, 
              color: colors.text,
              borderColor: colors.border 
            }]}
            value={workflowName}
            onChangeText={setWorkflowName}
            placeholder="e.g., Custom Bread Recipe"
            placeholderTextColor={colors.textSecondary}
            editable={!isSaving}
          />
        </View>

        {/* Steps */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Steps</Text>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={addStep}
              disabled={isSaving}
            >
              <Text style={styles.addButtonText}>+ Add Step</Text>
            </TouchableOpacity>
          </View>

          {steps.map((step, stepIndex) => (
            <View 
              key={stepIndex}
              style={[styles.stepCard, { 
                backgroundColor: colors.surface,
                borderColor: colors.border 
              }]}
            >
              <View style={styles.stepHeader}>
                <Text style={[styles.stepNumber, { color: colors.primary }]}>
                  Step {stepIndex + 1}
                </Text>
                {steps.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeStep(stepIndex)}
                    style={[styles.removeButton, { backgroundColor: colors.error }]}
                    disabled={isSaving}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Title *
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                value={step.title}
                onChangeText={(text) => updateStep(stepIndex, 'title', text)}
                placeholder="e.g., Mix dry ingredients"
                placeholderTextColor={colors.textSecondary}
                editable={!isSaving}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Instructions
              </Text>
              <TextInput
                style={[styles.textArea, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                value={step.description}
                onChangeText={(text) => updateStep(stepIndex, 'description', text)}
                placeholder="Add detailed instructions here..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                editable={!isSaving}
              />

              {/* Checklist Section */}
              <View style={styles.checklistSection}>
                <View style={styles.checklistHeader}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Checklist Items
                  </Text>
                  <TouchableOpacity
                    style={[styles.addChecklistButton, { backgroundColor: colors.success }]}
                    onPress={() => addChecklistItem(stepIndex)}
                    disabled={isSaving}
                  >
                    <Text style={styles.addChecklistButtonText}>+ Item</Text>
                  </TouchableOpacity>
                </View>

                {step.checklistItems && step.checklistItems.length > 0 && (
                  <View style={styles.checklistItems}>
                    {step.checklistItems.map((item, itemIndex) => (
                      <View key={itemIndex} style={styles.checklistItemRow}>
                        <TextInput
                          style={[styles.checklistInput, { 
                            backgroundColor: colors.background, 
                            color: colors.text,
                            borderColor: colors.border 
                          }]}
                          value={item.text}
                          onChangeText={(text) => updateChecklistItem(stepIndex, itemIndex, text)}
                          placeholder="e.g., Flour: 500g"
                          placeholderTextColor={colors.textSecondary}
                          editable={!isSaving}
                        />
                        <TouchableOpacity
                          onPress={() => removeChecklistItem(stepIndex, itemIndex)}
                          style={[styles.removeItemButton, { backgroundColor: colors.error }]}
                          disabled={isSaving}
                        >
                          <Text style={styles.removeItemButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Timer (minutes)
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                value={step.timerMinutes?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text);
                  updateStep(stepIndex, 'timerMinutes', isNaN(num) ? undefined : num);
                }}
                placeholder="Optional - e.g., 30"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                editable={!isSaving}
              />

              {/* YouTube Video URL */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                YouTube Video URL (optional)
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                value={step.youtubeUrl || ''}
                onChangeText={(text) => updateStep(stepIndex, 'youtubeUrl', text)}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
                editable={!isSaving}
              />

              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                💡 Tip: Add ingredient amounts like "Flour: 500g" for batch scaling
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { 
        backgroundColor: colors.surface,
        borderTopColor: colors.border 
      }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.surfaceVariant }]}
          onPress={() => router.back()}
          disabled={isSaving}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>
            {isSaving ? 'Saving...' : 'Cancel'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
          onPress={saveWorkflow}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? '⏳ Saving...' : 'Save Workflow'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionLabel: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  addButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, minHeight: 100, textAlignVertical: 'top' },
  stepCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  stepNumber: { fontSize: 20, fontWeight: 'bold' },
  removeButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  removeButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  checklistSection: { marginBottom: 16 },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addChecklistButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addChecklistButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  checklistItems: { gap: 8 },
  checklistItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checklistInput: { flex: 1, borderWidth: 1, borderRadius: 6, padding: 10, fontSize: 14 },
  removeItemButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  removeItemButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  helperText: { fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  saveButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});