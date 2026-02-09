import { useLocalSearchParams, useRouter } from "expo-router";
import { FC, useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, StyleSheet, Alert } from "react-native";
import * as Haptics from 'expo-haptics';
import { 
  getWorkflows, getBatch, updateBatchStep, completeBatchStep,
  getTimerStatus, acknowledgeTimer, getDeviceName,
  Workflow, Batch 
} from "../../services/database";
import { createBatchCompletionReport } from "../../services/reports";
import BatchTimer from '../components/BatchTimer';
import YouTubeVideo from '../components/YouTubeVideo';
import { useTheme } from '../../contexts/ThemeContext';
import { useVoiceCommands, VoiceCommand } from '../../hooks/useVoiceCommands';

// Haptic feedback helpers
const haptics = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  selection: () => Haptics.selectionAsync(),
};

export const StepScreen: FC = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const { batchId } = useLocalSearchParams<{ batchId: string }>();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Voice Commands Setup
  const voiceCommands: VoiceCommand[] = [
    {
      command: 'next step',
      aliases: ['next', 'continue', 'move on', 'go on'],
      action: () => handleNext(),
    },
    {
      command: 'previous step',
      aliases: ['back', 'go back', 'last step', 'previous'],
      action: () => handlePrevious(),
    },
    {
      command: 'clear checklist',
      aliases: ['clear', 'clear all', 'reset checklist'],
      action: () => handleClear(),
    },
    {
      command: 'finish batch',
      aliases: ['finish', 'complete', 'done', 'all done'],
      action: () => {
        if (currentStepIndex === workflow!.steps.length - 1) {
          handleFinish();
        } else {
          Alert.alert('Not Ready', 'Complete all steps before finishing');
        }
      },
    },
  ];

  const { isListening, recognizedText, error: voiceError, startListening, stopListening } =
    useVoiceCommands(voiceCommands);

  useEffect(() => {
    const interval = setInterval(() => {
      if (batchId) {
        const b = getBatch(batchId);
        if (b) {
          setBatch(b);
          b.activeTimers.forEach(timer => {
            const status = getTimerStatus(timer);
            if (status.isExpired && !timer.acknowledged) {
              acknowledgeTimer(batchId, timer.id);
            }
          });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [batchId]);

  useEffect(() => {
    if (!batchId) return;
    
    const b = getBatch(batchId);
    
    if (b) {
      setBatch(b);
      setCurrentStepIndex(b.currentStepIndex);
      
      const wf = getWorkflows().find(w => w.id === b.workflowId);
      if (wf) {
        setWorkflow(wf);
      }
    }
  }, [batchId, currentStepIndex]);

  if (!batch || !workflow) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {!batchId ? 'No batch ID provided' : !batch ? 'Batch not found' : 'Workflow not found'}
          </Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentStep = workflow.steps[currentStepIndex];

  if (!currentStep) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            No step found at index {currentStepIndex}
          </Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const extractChecklistItems = (step: any): string[] => {
  // Priority 1: Check for separate ingredients array (from URL parser and spreadsheet parser)
  if (step.ingredients && Array.isArray(step.ingredients) && step.ingredients.length > 0) {
    return step.ingredients;
  }
  
  // Priority 2: Check for checklistItems array (from recipe text parser)
  if (step.checklistItems && Array.isArray(step.checklistItems) && step.checklistItems.length > 0) {
    return step.checklistItems;
  }
  
  // Priority 3: Extract from description (legacy format)
  const checklistMatch = step.description.match(/Checklist:\n([\s\S]*?)(?=\n\n|$)/);
  if (!checklistMatch) return [];
  
  return checklistMatch[1]
    .split('\n')
    .map((line: string)=> line.replace(/^☐\s*/, '').trim())
    .filter(Boolean);
};

  const extractYouTubeUrl = (description: string): string | null => {
    const match = description.match(/Video:\s*(https?:\/\/[^\s]+)/);
    return match ? match[1] : null;
  };

  const applyBatchMultiplier = (text: string, multiplier: number): string => {
    if (multiplier === 1) return text;
    
    return text.replace(/(\d+(?:\.\d+)?)\s*(g|kg|ml|L|oz|lb|cup|tbsp|tsp)/gi, (match, number, unit) => {
      const originalNum = parseFloat(number);
      const newNum = originalNum * multiplier;
      const rounded = Math.round(newNum * 10) / 10;
      return `${rounded}${unit}`;
    });
  };

  const checklistItems = extractChecklistItems(currentStep.description).map(item => 
    applyBatchMultiplier(item, batch.batchSizeMultiplier)
  );
  
  const youtubeUrl = extractYouTubeUrl(currentStep.description);
  
  const displayDescription = applyBatchMultiplier(
    currentStep.description
      .replace(/Checklist:\n[\s\S]*?(?=\n\n|$)/, '')
      .replace(/Video:\s*https?:\/\/[^\s]+/, '')
      .trim(),
    batch.batchSizeMultiplier
  );
  
  const allItemsChecked = checklistItems.length > 0 && checklistItems.every(item => checkedItems.has(item));
  const isLastStep = currentStepIndex === workflow.steps.length - 1;

  const handleNext = async () => {
    if (checklistItems.length > 0 && !allItemsChecked) {
      haptics.warning();
      Alert.alert('Incomplete', 'Please check all items before proceeding.');
      return;
    }

    haptics.success();
    await completeBatchStep(batchId!, currentStep.id);

    if (currentStepIndex < workflow.steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      await updateBatchStep(batchId!, newIndex);
      setCheckedItems(new Set());
    }
  };

  const handleFinish = async () => {
    if (checklistItems.length > 0 && !allItemsChecked) {
      haptics.warning();
      Alert.alert('Incomplete', 'Please check all items before finishing.');
      return;
    }

    await completeBatchStep(batchId!, currentStep.id);

    // Create batch completion report
    try {
      const deviceName = await getDeviceName();
      const endTime = Date.now();
      const startTime = batch.createdAt;
      const actualDuration = Math.round((endTime - startTime) / 1000 / 60);

      await createBatchCompletionReport(
        batchId!,
        batch.name,
        workflow.id,
        workflow.name,
        deviceName,
        batch.batchSizeMultiplier,
        actualDuration
      );
    } catch (error) {
      console.error('Error creating batch report:', error);
    }

    haptics.success();
    Alert.alert(
      'Batch Complete!',
      `You've completed ${batch.name}\n\nReport saved!`,
      [
        {
          text: 'Done',
          onPress: () => router.back()
        }
      ]
    );
  };

  const handlePrevious = async () => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      await updateBatchStep(batchId!, newIndex);
      setCheckedItems(new Set());
    }
  };

  const handleClear = () => {
    haptics.light();
    setCheckedItems(new Set());
  };

  const toggleCheckbox = (item: string) => {
    haptics.light();
    const newChecked = new Set(checkedItems);
    if (newChecked.has(item)) {
      newChecked.delete(item);
    } else {
      newChecked.add(item);
    }
    setCheckedItems(newChecked);
  };

  const isSubRecipeLink = (item: string): boolean => {
    return item.includes('*See') && item.includes('recipe');
  };

  const extractSubRecipeName = (item: string): string => {
    const match = item.match(/\*See (.+?) recipe/);
    return match ? match[1] : '';
  };

  const handleSubRecipeClick = (subRecipeName: string) => {
    const subWorkflow = getWorkflows().find(w => 
      w.name.toLowerCase().includes(subRecipeName.toLowerCase())
    );
    
    if (subWorkflow) {
      Alert.alert(
        subRecipeName,
        'Open this sub-recipe?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open', 
            onPress: async () => {
              const { createBatch } = require('../../services/database');
              const subBatch = await createBatch(subWorkflow.id, batch.mode);
              router.push({
                pathname: '/screens/StepScreen',
                params: { batchId: subBatch.id }
              });
            }
          }
        ]
      );
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      contentContainerStyle={styles.content}
    >
      {/* Voice Command Status Banner */}
      {isListening && (
        <View style={[styles.voiceBanner, { backgroundColor: colors.success }]}>
          <Text style={styles.voiceBannerText}>Listening...</Text>
        </View>
      )}

      {recognizedText && !isListening && (
        <View style={[styles.voiceBanner, { backgroundColor: colors.primary + '40' }]}>
          <Text style={[styles.voiceBannerSmallText, { color: colors.text }]}>
            Heard: "{recognizedText}"
          </Text>
        </View>
      )}

      {voiceError && (
        <View style={[styles.voiceBanner, { backgroundColor: colors.error + '20' }]}>
          <Text style={[styles.voiceBannerSmallText, { color: colors.error }]}>
            {voiceError}
          </Text>
        </View>
      )}

      {/* Header with Clear button */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            Step {currentStepIndex + 1} of {workflow.steps.length}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${((currentStepIndex + 1) / workflow.steps.length) * 100}%`,
                  backgroundColor: colors.primary
                }
              ]} 
            />
          </View>
        </View>

        {checklistItems.length > 0 && (
          <TouchableOpacity 
            onPress={handleClear} 
            style={[styles.clearButton, { backgroundColor: colors.textSecondary }]}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Voice Command Button - Big and Easy to Press */}
      <TouchableOpacity
        onPress={isListening ? stopListening : startListening}
        style={[
          styles.voiceButton,
          { backgroundColor: isListening ? colors.error : colors.success }
        ]}
      >
        <Text style={styles.voiceButtonText}>
          {isListening ? 'Stop Voice Commands' : 'Voice Commands'}
        </Text>
      </TouchableOpacity>

      {/* Step title */}
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{currentStep.title}</Text>
        {batch.batchSizeMultiplier !== 1 && (
          <View style={[styles.multiplierBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.multiplierText}>{batch.batchSizeMultiplier}x</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      {displayDescription && (
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Instructions</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{displayDescription}</Text>
        </View>
      )}

      {/* YouTube Video */}
      {youtubeUrl && (
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Video Tutorial</Text>
          <YouTubeVideo url={youtubeUrl} />
        </View>
      )}

      {/* Checklist */}
      {checklistItems.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Checklist ({checkedItems.size}/{checklistItems.length})
          </Text>
          {checklistItems.map((item, index) => {
            const isLink = isSubRecipeLink(item);
            const isChecked = checkedItems.has(item);
            
            return (
              <View key={index} style={styles.checklistItem}>
                <TouchableOpacity
                  onPress={() => toggleCheckbox(item)}
                  style={styles.checkbox}
                >
                  <View style={[
                    styles.checkboxBox, 
                    { borderColor: colors.primary },
                    isChecked && { backgroundColor: colors.primary }
                  ]}>
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                
                {isLink ? (
                  <TouchableOpacity 
                    onPress={() => handleSubRecipeClick(extractSubRecipeName(item))}
                    style={styles.linkContainer}
                  >
                    <Text style={[styles.linkText, { color: colors.primary }]}>{item}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.checklistText, { color: colors.text }]}>{item}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Timer */}
      {currentStep.timerMinutes != null && (
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Timer</Text>
          <BatchTimer
            batchId={batchId!}
            stepId={currentStep.id}
            durationMinutes={currentStep.timerMinutes}
          />
        </View>
      )}

      {/* Voice Commands Help */}
      <View style={[styles.card, { backgroundColor: colors.surface + '80', shadowColor: colors.shadow }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 14 }]}>
          Say These Commands:
        </Text>
        <Text style={[styles.voiceHelpText, { color: colors.textSecondary }]}>
          • "Next step" or "Previous step"{'\n'}
          • "Clear checklist"{'\n'}
          • "Finish batch" (on last step)
        </Text>
      </View>

      {/* Navigation buttons */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          onPress={handlePrevious}
          style={[
            styles.navButton, 
            { backgroundColor: colors.textSecondary },
            currentStepIndex === 0 && { backgroundColor: colors.disabled }
          ]}
          disabled={currentStepIndex === 0}
        >
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        {isLastStep ? (
          <TouchableOpacity
            onPress={handleFinish}
            style={[
              styles.navButton, 
              { backgroundColor: colors.success },
              (!allItemsChecked && checklistItems.length > 0) && { backgroundColor: colors.disabled }
            ]}
            disabled={!allItemsChecked && checklistItems.length > 0}
          >
            <Text style={styles.navButtonText}>Finish</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleNext}
            style={[
              styles.navButton, 
              { backgroundColor: colors.primary },
              (!allItemsChecked && checklistItems.length > 0) && { backgroundColor: colors.disabled }
            ]}
            disabled={!allItemsChecked && checklistItems.length > 0}
          >
            <Text style={styles.navButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress indicator at bottom */}
      {(!allItemsChecked && checklistItems.length > 0) && (
        <View style={[styles.warningContainer, { 
          backgroundColor: colors.warning + '20',
          borderColor: colors.warning 
        }]}>
          <Text style={[styles.warningText, { color: colors.warning }]}>
            Check all items to continue
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  backButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  voiceBanner: { 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 12,
    alignItems: 'center',
  },
  voiceBannerText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '600',
  },
  voiceBannerSmallText: { 
    fontSize: 14, 
    fontWeight: '500',
  },
  voiceButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  voiceButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  voiceHelpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  progressContainer: { flex: 1, marginRight: 12 },
  progressText: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  clearButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  clearButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  stepTitle: { fontSize: 28, fontWeight: 'bold', flex: 1 },
  multiplierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  multiplierText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  card: { borderRadius: 12, padding: 16, marginBottom: 16, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  description: { fontSize: 16, lineHeight: 24 },
  checklistItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkbox: { padding: 4 },
  checkboxBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkmark: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  checklistText: { flex: 1, fontSize: 16, lineHeight: 24 },
  linkContainer: { flex: 1 },
  linkText: { fontSize: 16, lineHeight: 24, textDecorationLine: 'underline' },
  navigationContainer: { flexDirection: 'row', gap: 12, marginTop: 20 },
  navButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  warningContainer: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 16 },
  warningText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

export default StepScreen;