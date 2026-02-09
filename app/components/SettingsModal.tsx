import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getWorkflows, setWorkflows,
  getDeviceName, setDeviceName, Workflow
} from '../../services/database';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onWorkflowsUpdated: () => void;
}

export default function SettingsModal({ visible, onClose, onWorkflowsUpdated }: SettingsModalProps) {
  const router = useRouter();
  const { colors, theme, setTheme } = useTheme();
  const [workflows, setWorkflowsList] = useState<Workflow[]>([]);
  const [deviceName, setDeviceNameState] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    const wfs = getWorkflows();
    setWorkflowsList(wfs);
    const name = await getDeviceName();
    setDeviceNameState(name);
  };

  const handleDeviceNameSave = async () => {
    if (deviceName.trim()) {
      await setDeviceName(deviceName.trim());
      Alert.alert('Success', 'Device name updated!');
    }
  };

  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv'
        ],
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      console.log('📥 Reading file:', file.name);
      
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const newWorkflows: Workflow[] = [];
      
      console.log('Found sheets:', workbook.SheetNames);
      
      workbook.SheetNames.forEach((sheetName) => {
        if (sheetName === 'SOP_Template') return;

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

        console.log(`Sheet "${sheetName}" has ${rows.length} rows`);

        if (rows.length === 0) return;

        const workflowId = `${sheetName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        const steps: any[] = [];

        const stepGroups = new Map<number, any[]>();
        
        rows.forEach((row) => {
          const stepNum = row['Step Number'];
          
          if (stepNum && typeof stepNum === 'number' && !isNaN(stepNum)) {
            if (!stepGroups.has(stepNum)) {
              stepGroups.set(stepNum, []);
            }
            stepGroups.get(stepNum)!.push(row);
          } else if (stepGroups.size > 0) {
            const lastStepNum = Array.from(stepGroups.keys()).pop()!;
            stepGroups.get(lastStepNum)!.push(row);
          }
        });

        console.log(`Grouped into ${stepGroups.size} steps`);

        stepGroups.forEach((stepRows, stepNum) => {
          const firstRow = stepRows[0];
          
          const instructions = firstRow['Instructions'] || '';
          const timerStr = firstRow['Suggested Time (min)'] || '';
          const targetTemp = firstRow['Target Temp (°C)'];
          const visualCues = firstRow['Visual Cues'] || '';
          
          let description = String(instructions).trim();
          
          const ingredients: string[] = [];
          stepRows.forEach((row) => {
            const ingredient = row['Requirements / Components (Checklist)'];
            const amount = row['Amount (grams)'];
            
            if (ingredient && String(ingredient).trim()) {
              if (amount) {
                ingredients.push(`${ingredient}: ${amount}g`);
              } else {
                ingredients.push(String(ingredient));
              }
            }
          });

          if (targetTemp) {
            description += `\n\nTarget Temperature: ${targetTemp}°C`;
          }

          if (visualCues) {
            description += `\n\nVisual Cues: ${visualCues}`;
          }

          if (ingredients.length > 0) {
            if (description) {
              description += '\n\n';
            }
            description += '📋 Checklist:\n' + ingredients.map(item => `☐ ${item}`).join('\n');
          }

          steps.push({
            id: `${workflowId}_step_${stepNum}`,
            title: instructions || `Step ${stepNum}`,
            description: description.trim(),
            timerMinutes: timerStr ? parseInt(String(timerStr)) : undefined,
            completed: false,
          });
        });

        console.log(`Created ${steps.length} steps for workflow "${sheetName}"`);

        if (steps.length > 0) {
          newWorkflows.push({
            id: workflowId,
            name: sheetName,
            steps,
          });
        }
      });

      if (newWorkflows.length === 0) {
        Alert.alert('Error', 'No valid workflows found in the file');
        return;
      }

      const existingWorkflows = getWorkflows();
      await setWorkflows([...existingWorkflows, ...newWorkflows]);
      
      setShowImportModal(false);
      loadData();
      onWorkflowsUpdated();
      
      Alert.alert(
        'Success!', 
        `Imported ${newWorkflows.length} workflow(s):\n${newWorkflows.map(w => w.name).join(', ')}`
      );
    } catch (error) {
      console.error('Excel import error:', error);
      Alert.alert('Error', `Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const toggleWorkflowSelection = (id: string) => {
    const newSelection = new Set(selectedForRemoval);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedForRemoval(newSelection);
  };

  const handleRemoveSelected = async () => {
    if (selectedForRemoval.size === 0) {
      Alert.alert('Error', 'No workflows selected');
      return;
    }

    Alert.alert(
      'Confirm Removal',
      `Remove ${selectedForRemoval.size} workflow(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedWorkflows = workflows.filter(
              wf => !selectedForRemoval.has(wf.id)
            );
            await setWorkflows(updatedWorkflows);
            
            setSelectedForRemoval(new Set());
            setShowRemoveModal(false);
            loadData();
            onWorkflowsUpdated();
            Alert.alert('Success', 'Workflows removed!');
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Device Name</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colors.background, 
                    color: colors.text,
                    borderColor: colors.border 
                  }]}
                  value={deviceName}
                  onChangeText={setDeviceNameState}
                  placeholder="e.g., Oven Station 1"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleDeviceNameSave}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme</Text>
              <View style={styles.themeOptions}>
                {(['light', 'dark', 'auto'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.themeButton,
                      { borderColor: colors.border },
                      theme === t && { 
                        backgroundColor: colors.primary,
                        borderColor: colors.primary 
                      }
                    ]}
                    onPress={() => setTheme(t)}
                  >
                    <Text style={[
                      styles.themeButtonText,
                      { color: theme === t ? 'white' : colors.text }
                    ]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Workflows</Text>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  router.push('/screens/WorkflowBuilderScreen');
                  onClose();
                }}
              >
                <Text style={styles.actionButtonText}>Create Custom Workflow</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={() => setShowImportModal(true)}
              >
                <Text style={styles.actionButtonText}>Import Workflow</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                onPress={() => setShowRemoveModal(true)}
              >
                <Text style={styles.actionButtonText}>Remove Workflows</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={showImportModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.importModalOverlay}>
          <View style={[styles.importModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.importModalTitle, { color: colors.text }]}>
              Import Workflow
            </Text>
            <Text style={[styles.importModalSubtitle, { color: colors.textSecondary }]}>
              Choose import method
            </Text>

            <TouchableOpacity
              style={[styles.importButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
              onPress={() => {
                setShowImportModal(false);
                handleImportExcel();
              }}
            >
              <Text style={styles.importButtonIcon}>📊</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.importButtonTitle, { color: colors.text }]}>
                  Spreadsheet
                </Text>
                <Text style={[styles.importButtonSubtitle, { color: colors.textSecondary }]}>
                  Excel (.xlsx), Google Sheets, CSV
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
              onPress={() => {
                setShowImportModal(false);
                router.push('/screens/RecipeParserScreen');
                onClose();
              }}
            >
              <Text style={styles.importButtonIcon}>📝</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.importButtonTitle, { color: colors.text }]}>
                  Text Recipe
                </Text>
                <Text style={[styles.importButtonSubtitle, { color: colors.textSecondary }]}>
                  Paste recipe text with auto-detection
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importButton, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}
              onPress={() => {
                setShowImportModal(false);
                router.push('/screens/URLImportScreen');
                onClose();
              }}
            >
              <Text style={styles.importButtonIcon}>🌐</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.importButtonTitle, { color: colors.text }]}>
                  From URL
                </Text>
                <Text style={[styles.importButtonSubtitle, { color: colors.textSecondary }]}>
                  Import from recipe websites
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.importCancelButton}
              onPress={() => setShowImportModal(false)}
            >
              <Text style={[styles.importCancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRemoveModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRemoveModal(false)}
      >
        <View style={styles.removeModalOverlay}>
          <View style={[styles.removeModalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.removeModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.removeModalTitle, { color: colors.text }]}>
                Select Workflows to Remove
              </Text>
            </View>

            <ScrollView style={styles.removeScrollView}>
              {workflows.map(workflow => (
                <TouchableOpacity
                  key={workflow.id}
                  style={[styles.workflowItem, { borderBottomColor: colors.border }]}
                  onPress={() => toggleWorkflowSelection(workflow.id)}
                >
                  <View style={styles.workflowItemContent}>
                    <View style={styles.checkboxContainer}>
                      <View style={[
                        styles.checkbox,
                        { borderColor: colors.primary },
                        selectedForRemoval.has(workflow.id) && { 
                          backgroundColor: colors.primary 
                        }
                      ]}>
                        {selectedForRemoval.has(workflow.id) && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workflowName, { color: colors.text }]}>
                        {workflow.name}
                      </Text>
                      <Text style={[styles.workflowSteps, { color: colors.textSecondary }]}>
                        {workflow.steps.length} steps
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={[styles.removeModalActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.removeModalButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setSelectedForRemoval(new Set());
                  setShowRemoveModal(false);
                }}
              >
                <Text style={[styles.removeModalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.removeModalButton, 
                  { backgroundColor: colors.error },
                  selectedForRemoval.size === 0 && { backgroundColor: colors.disabled }
                ]}
                onPress={handleRemoveSelected}
                disabled={selectedForRemoval.size === 0}
              >
                <Text style={styles.removeModalButtonText}>
                  Remove ({selectedForRemoval.size})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 24, fontWeight: 'bold' },
  closeButton: { fontSize: 16, fontWeight: '600' },
  scrollView: { padding: 20 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  saveButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, justifyContent: 'center' },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  themeOptions: { flexDirection: 'row', gap: 12 },
  themeButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 2, alignItems: 'center' },
  themeButtonText: { fontSize: 16, fontWeight: '600' },
  actionButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  actionButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  importModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  importModalContent: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24 },
  importModalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  importModalSubtitle: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  importButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 2, marginBottom: 12, gap: 12 },
  importButtonIcon: { fontSize: 32 },
  importButtonTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  importButtonSubtitle: { fontSize: 14 },
  importCancelButton: { padding: 12, marginTop: 8 },
  importCancelText: { fontSize: 16, textAlign: 'center' },
  removeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  removeModalContent: { width: '100%', maxHeight: '80%', borderRadius: 16, overflow: 'hidden' },
  removeModalHeader: { padding: 20, borderBottomWidth: 1 },
  removeModalTitle: { fontSize: 20, fontWeight: 'bold' },
  removeScrollView: { maxHeight: 400 },
  workflowItem: { padding: 16, borderBottomWidth: 1 },
  workflowItemContent: { flexDirection: 'row', alignItems: 'center' },
  checkboxContainer: { marginRight: 12 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  checkmark: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  workflowName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  workflowSteps: { fontSize: 14 },
  removeModalActions: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  removeModalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  removeModalButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});