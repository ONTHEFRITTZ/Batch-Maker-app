import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { getWorkflows, setWorkflows, Workflow, Step } from '../../services/database';

interface ChecklistItem {
  text: string;
}

interface StepWithExtras extends Partial<Step> {
  checklistItems?: ChecklistItem[];
  youtubeUrl?: string;
}

export default function WorkflowEditorScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { workflowId } = useLocalSearchParams<{ workflowId: string }>();
  
  const [workflowName, setWorkflowName] = useState('');
  const [steps, setSteps] = useState<StepWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadWorkflow();
  }, [workflowId]);

  const loadWorkflow = () => {
    const workflows = getWorkflows();
    const workflow = workflows.find(w => w.id === workflowId);
    
    if (!workflow) {
      Alert.alert('Error', 'Workflow not found');
      router.back();
      return;
    }

    setWorkflowName(workflow.name);
    
    // Parse steps and extract all metadata
    const parsedSteps: StepWithExtras[] = workflow.steps.map(step => {
      let description = step.description;
      let checklistItems: ChecklistItem[] = [];
      let youtubeUrl: string | undefined;

      // Extract checklist
      const checklistMatch = description.match(/📋 Checklist:\n([\s\S]*?)(?=\n\n|$)/);
      if (checklistMatch) {
        const items = checklistMatch[1]
          .split('\n')
          .map(line => line.replace(/^☐\s*/, '').trim())
          .filter(Boolean);
        
        checklistItems = items.map(text => ({ text }));
        description = description.replace(/📋 Checklist:\n[\s\S]*?(?=\n\n|$)/, '').trim();
      }

      // Extract YouTube URL
      const youtubeMatch = description.match(/🎥 Video:\s*(https?:\/\/[^\s]+)/);
      if (youtubeMatch) {
        youtubeUrl = youtubeMatch[1];
        description = description.replace(/🎥 Video:\s*https?:\/\/[^\s]+/, '').trim();
      }

      return {
        id: step.id,
        title: step.title,
        description,
        timerMinutes: step.timerMinutes,
        checklistItems,
        youtubeUrl,
      };
    });

    setSteps(parsedSteps);
    setLoading(false);
  };

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
          id: step.id || `${workflowId}_step_${index + 1}`,
          title: step.title || '',
          description,
          timerMinutes: step.timerMinutes,
          completed: false,
        });
      }

      const updatedWorkflow: Workflow = {
        id: workflowId!,
        name: workflowName,
        steps: processedSteps,
      };

      // Update the workflow in the list
      const allWorkflows = getWorkflows();
      const updatedWorkflows = allWorkflows.map(w => 
        w.id === workflowId ? updatedWorkflow : w
      );
      
      await setWorkflows(updatedWorkflows);

      Alert.alert('Success', 'Workflow updated!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        }
      ]);
    } catch (error) {
      console.error('Error saving workflow:', error);
      Alert.alert('Error', `Failed to save workflow: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
      </View>
    );
  }

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
            {isSaving ? '⏳ Saving...' : 'Save Changes'}
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
  loadingText: { fontSize: 16, textAlign: 'center', marginTop: 40 },
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