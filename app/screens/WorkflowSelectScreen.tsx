import { useRouter } from "expo-router";
import React, { FC, useEffect, useState } from "react";
import { 
  FlatList, Text, View, TouchableOpacity, StyleSheet, Alert,
  TextInput, Modal, Animated, ScrollView, Switch
} from "react-native";
import { 
  getWorkflows, getBatches, createBatch, duplicateBatch, 
  renameBatch, deleteBatch, batchHasProgress, getMostUrgentTimer,
  batchHasExpiredTimer, getTimerStatus, formatTimeRemaining,
  claimWorkflow, unclaimWorkflow, getClaimedWorkflows, getUnclaimedWorkflows,
  isWorkflowClaimedByMe, archiveWorkflow, unarchiveWorkflow,
  Workflow, Batch
} from "../../services/database";
import SettingsModal from "../components/SettingsModal";
import { useTheme } from "../../contexts/ThemeContext";

const BatchItem: FC<{
  item: Batch;
  workflows: Workflow[];
  contextMenuBatch: string | null;
  renamingBatch: string | null;
  renameText: string;
  colors: any;
  isClaimed: boolean;
  setContextMenuBatch: (id: string | null) => void;
  setRenamingBatch: (id: string | null) => void;
  setRenameText: (text: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClaim: (id: string) => void;
  onPress: (id: string) => void;
}> = ({
  item,
  workflows,
  contextMenuBatch,
  renamingBatch,
  renameText,
  colors,
  isClaimed,
  setContextMenuBatch,
  setRenamingBatch,
  setRenameText,
  onRename,
  onDuplicate,
  onDelete,
  onClaim,
  onPress,
}) => {
  const workflow = workflows.find(w => w.id === item.workflowId);
  
  if (!workflow) return null;

  const hasExpired = batchHasExpiredTimer(item);
  const isContextMenuOpen = contextMenuBatch === item.id;
  const isRenaming = renamingBatch === item.id;

  let timerDisplay = "—";
  if (item.activeTimers.length > 0) {
    const urgentTimer = getMostUrgentTimer(item);
    if (urgentTimer) {
      const status = getTimerStatus(urgentTimer);
      timerDisplay = status.isExpired ? "EXPIRED" : formatTimeRemaining(status.remainingSeconds);
    }
  }

  const modeIcon = item.mode === 'bake-today' ? '🟢' : '🔵';
  const modeText = item.mode === 'bake-today' ? 'Bake Today' : 'Cold Ferment';

  const flashAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (hasExpired) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      flashAnim.setValue(1);
    }
  }, [hasExpired]);

  return (
    <View style={styles.batchContainer}>
      <Animated.View style={{ opacity: flashAnim }}>
        <TouchableOpacity
          style={[
            styles.batchCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            hasExpired && { backgroundColor: colors.error + '20', borderColor: colors.error, borderWidth: 2 }
          ]}
          onPress={() => onPress(item.id)}
          onLongPress={() => setContextMenuBatch(item.id)}
          delayLongPress={500}
        >
          <View style={styles.batchHeader}>
            {isRenaming ? (
              <TextInput
                style={[styles.renameInput, { color: colors.text, borderBottomColor: colors.primary }]}
                value={renameText}
                onChangeText={setRenameText}
                onBlur={() => onRename(item.id)}
                onSubmitEditing={() => onRename(item.id)}
                autoFocus
                selectTextOnFocus
              />
            ) : (
              <View>
                <Text style={[styles.batchName, { color: colors.text }]}>{item.name}</Text>
                {workflow.claimedByName && (
                  <Text style={[styles.claimedByLabel, { color: colors.success }]}>
                    {isClaimed ? 'Your batch' : `${workflow.claimedByName}`}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.batchInfo}>
            <Text style={[styles.batchMode, { color: colors.textSecondary }]}>{modeIcon} {modeText}</Text>
            <Text style={[
              styles.batchTimer,
              { color: hasExpired ? colors.error : colors.primary }
            ]}>
              {timerDisplay}
            </Text>
          </View>

          {item.activeTimers.length > 1 && (
            <Text style={[styles.timerCount, { color: colors.textSecondary }]}>
              ({item.activeTimers.length} timers active)
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {isContextMenuOpen && (
        <View style={[styles.contextMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={[styles.contextMenuItem, { borderBottomColor: colors.border }]}
            onPress={() => {
              setRenamingBatch(item.id);
              setRenameText(item.name);
              setContextMenuBatch(null);
            }}
          >
            <Text style={[styles.contextMenuText, { color: colors.text }]}>Rename</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.contextMenuItem, { borderBottomColor: colors.border }]}
            onPress={() => onDuplicate(item.id)}
          >
            <Text style={[styles.contextMenuText, { color: colors.text }]}>Duplicate</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.contextMenuItem, { borderBottomColor: colors.border }]}
            onPress={() => onClaim(item.id)}
          >
            <Text style={[styles.contextMenuText, { color: isClaimed ? colors.error : colors.primary }]}>
              {isClaimed ? 'Release' : 'Claim'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.contextMenuItem, { borderBottomColor: colors.border, backgroundColor: colors.error + '15' }]}
            onPress={() => onDelete(item.id)}
          >
            <Text style={[styles.contextMenuText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contextMenuItem}
            onPress={() => setContextMenuBatch(null)}
          >
            <Text style={[styles.contextMenuText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const WorkflowItem: FC<{
  item: Workflow;
  colors: any;
  hasActiveBatches: boolean;
  isClaimed: boolean;
  contextMenuOpen: boolean;
  onSelectWorkflow: (id: string) => void;
  onLongPress: (id: string) => void;
}> = ({ item, colors, hasActiveBatches, isClaimed, contextMenuOpen, onSelectWorkflow, onLongPress }) => {
  return (
    <View style={styles.workflowContainer}>
      <TouchableOpacity
        style={[styles.workflowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => onSelectWorkflow(item.id)}
        onLongPress={() => onLongPress(item.id)}
        delayLongPress={500}
      >
        <View style={styles.workflowHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.workflowName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.workflowSteps, { color: colors.textSecondary }]}>
              {item.steps.length} steps
            </Text>
            {item.claimedBy && !isClaimed && (
              <Text style={[styles.claimedLabel, { color: colors.warning }]}>
                {item.claimedByName || 'Another station'}
              </Text>
            )}
            {isClaimed && hasActiveBatches && (
              <Text style={[styles.claimedLabel, { color: colors.success }]}>
                You have active batches for this
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {contextMenuOpen && (
        <View style={[styles.contextMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={[styles.contextMenuItem, { borderBottomColor: colors.border }]}
            onPress={() => onSelectWorkflow(item.id)}
          >
            <Text style={[styles.contextMenuText, { color: colors.text }]}>Create Batch</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contextMenuItem}
            onPress={() => onLongPress('')}
          >
            <Text style={[styles.contextMenuText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export const WorkflowSelectScreen: FC = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [contextMenuBatch, setContextMenuBatch] = useState<string | null>(null);
  const [contextMenuWorkflow, setContextMenuWorkflow] = useState<string | null>(null);
  const [renamingBatch, setRenamingBatch] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [showMyWorkflows, setShowMyWorkflows] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [displayedWorkflows, setDisplayedWorkflows] = useState<Workflow[]>([]);
  const [batchSizeMultiplier, setBatchSizeMultiplier] = useState(1);
  
  const [claimedStatus, setClaimedStatus] = useState<Map<string, boolean>>(new Map());
  const [displayedBatches, setDisplayedBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const freshBatches = getBatches();
      setBatches([...freshBatches]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const allWorkflows = await getWorkflows();
    setWorkflows(allWorkflows);
    setBatches(getBatches());
    
    const statusMap = new Map<string, boolean>();
    for (const workflow of allWorkflows) {
      const claimed = await isWorkflowClaimedByMe(workflow.id);
      statusMap.set(workflow.id, claimed);
    }
    setClaimedStatus(statusMap);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Filter workflows based on archived toggle
    const filtered = showArchived 
      ? workflows 
      : workflows.filter(w => !w.archived);
    
    setDisplayedWorkflows(filtered);
  }, [showArchived, workflows]);

  useEffect(() => {
    if (showMyWorkflows) {
      const myBatches = batches.filter(batch => {
        const isClaimed = claimedStatus.get(batch.workflowId) || false;
        return isClaimed;
      });
      setDisplayedBatches(myBatches);
    } else {
      setDisplayedBatches(batches);
    }
  }, [showMyWorkflows, batches, claimedStatus]);

  const handleCreateBatch = async (mode: 'bake-today' | 'cold-ferment') => {
    if (!selectedWorkflow) return;
    
    await createBatch(selectedWorkflow, mode, 1, batchSizeMultiplier);
    setShowNewBatchModal(false);
    setSelectedWorkflow(null);
    setBatchSizeMultiplier(1);
    await loadData();
  };

  const handleDuplicateBatch = async (batchId: string) => {
    await duplicateBatch(batchId);
    setContextMenuBatch(null);
    await loadData();
  };

  const handleDeleteBatch = async (batchId: string) => {
    const hasProgress = batchHasProgress(batchId);
    
    if (hasProgress) {
      Alert.alert(
        'Delete Batch?',
        'This batch has progress. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
              await deleteBatch(batchId);
              setContextMenuBatch(null);
              await loadData();
            }
          }
        ]
      );
    } else {
      await deleteBatch(batchId);
      setContextMenuBatch(null);
      await loadData();
    }
  };

  const handleRenameBatch = async (batchId: string) => {
    if (renameText.trim()) {
      await renameBatch(batchId, renameText.trim());
      setRenamingBatch(null);
      setRenameText("");
      await loadData();
    }
  };

  const handleBatchPress = (batchId: string) => {
    router.push({
      pathname: '/screens/StepScreen',
      params: { batchId }
    });
  };

  const handleClaimBatch = async (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;

    const isClaimed = claimedStatus.get(batch.workflowId) || false;
    
    if (isClaimed) {
      await unclaimWorkflow(batch.workflowId);
    } else {
      await claimWorkflow(batch.workflowId);
    }
    
    setContextMenuBatch(null);
    await loadData();
  };

  const handleSelectWorkflow = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    setSelectedWorkflow(workflowId);
    
    // Check if workflow has ferment prompt enabled
    if (workflow.show_ferment_prompt === false) {
      // Skip modal, create batch directly as bake-today
      createBatch(workflowId, 'bake-today', 1, 1).then(() => loadData());
    } else {
      // Show modal
      setShowNewBatchModal(true);
    }
  };

  const handleArchiveWorkflow = async (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    try {
      if (workflow.archived) {
        await unarchiveWorkflow(workflowId);
      } else {
        await archiveWorkflow(workflowId);
      }
      setContextMenuWorkflow(null);
      await loadData();
    } catch (error) {
      console.error('Error toggling archive:', error);
      Alert.alert('Error', 'Failed to update workflow');
    }
  };

  const handleEditWorkflow = (workflowId: string) => {
    setContextMenuWorkflow(null);
    router.push({
      pathname: '/screens/WorkflowEditorScreen',
      params: { workflowId }
    });
  };

  const renderBatch = ({ item }: { item: Batch }) => {
    const isClaimed = claimedStatus.get(item.workflowId) || false;
    
    return (
      <BatchItem
        item={item}
        workflows={workflows}
        contextMenuBatch={contextMenuBatch}
        renamingBatch={renamingBatch}
        renameText={renameText}
        colors={colors}
        isClaimed={isClaimed}
        setContextMenuBatch={setContextMenuBatch}
        setRenamingBatch={setRenamingBatch}
        setRenameText={setRenameText}
        onRename={handleRenameBatch}
        onDuplicate={handleDuplicateBatch}
        onDelete={handleDeleteBatch}
        onClaim={handleClaimBatch}
        onPress={handleBatchPress}
      />
    );
  };

  const renderWorkflow = ({ item, contextMenuOpen, onLongPress }: { item: Workflow; contextMenuOpen: boolean; onLongPress: (id: string) => void }) => {
    const isClaimed = claimedStatus.get(item.id) || false;
    const hasActiveBatches = batches.some(b => b.workflowId === item.id);
    
    return (
      <WorkflowItem
        item={item}
        colors={colors}
        hasActiveBatches={hasActiveBatches}
        isClaimed={isClaimed}
        contextMenuOpen={contextMenuOpen}
        onSelectWorkflow={handleSelectWorkflow}
        onLongPress={onLongPress}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toggleBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            !showMyWorkflows && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
          ]}
          onPress={() => setShowMyWorkflows(false)}
        >
          <Text style={[
            styles.toggleText,
            { color: !showMyWorkflows ? colors.primary : colors.textSecondary }
          ]}>
            All Workflows
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleOption,
            showMyWorkflows && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
          ]}
          onPress={() => setShowMyWorkflows(true)}
        >
          <Text style={[
            styles.toggleText,
            { color: showMyWorkflows ? colors.primary : colors.textSecondary }
          ]}>
            My Workflows
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {displayedBatches.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Batches</Text>
            <View style={styles.listContent}>
              {displayedBatches.map(item => (
                <View key={item.id}>
                  {renderBatch({ item })}
                </View>
              ))}
            </View>
          </View>
        )}

        {!showMyWorkflows && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Start New Batch
              </Text>
              <View style={styles.archiveToggleContainer}>
                <Text style={[styles.archiveToggleLabel, { color: colors.textSecondary }]}>
                  Show Archived
                </Text>
                <Switch
                  value={showArchived}
                  onValueChange={setShowArchived}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            </View>
            {displayedWorkflows.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {showArchived ? 'No archived workflows' : 'No workflows yet'}
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  {showArchived ? 'Archive workflows by long-pressing them' : 'Tap settings to import'}
                </Text>
              </View>
            ) : (
              <View style={styles.listContent}>
                {displayedWorkflows.map(item => (
                  <View key={item.id}>
                    {renderWorkflow({ 
                      item, 
                      contextMenuOpen: contextMenuWorkflow === item.id,
                      onLongPress: (id) => {
                        if (id === '') {
                          setContextMenuWorkflow(null);
                        } else {
                          setContextMenuWorkflow(id);
                        }
                      }
                    })}
                    {contextMenuWorkflow === item.id && (
                      <View style={[styles.contextMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity 
                          style={[styles.contextMenuItem, { borderBottomColor: colors.border }]}
                          onPress={() => handleEditWorkflow(item.id)}
                        >
                          <Text style={[styles.contextMenuText, { color: colors.text }]}>Edit Workflow</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.contextMenuItem, { borderBottomColor: colors.border }]}
                          onPress={() => handleArchiveWorkflow(item.id)}
                        >
                          <Text style={[styles.contextMenuText, { color: colors.text }]}>
                            {item.archived ? 'Unarchive' : 'Archive'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.contextMenuItem}
                          onPress={() => setContextMenuWorkflow(null)}
                        >
                          <Text style={[styles.contextMenuText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {showMyWorkflows && displayedBatches.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No claimed batches
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Claim a batch from All Workflows to see it here
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={[styles.settingsButton, { backgroundColor: colors.primary }]}
        onPress={() => setSettingsVisible(true)}
      >
        <View style={styles.line} />
        <View style={styles.line} />
        <View style={styles.line} />
      </TouchableOpacity>

      <SettingsModal 
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onWorkflowsUpdated={loadData}
      />

      <Modal
        visible={showNewBatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewBatchModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNewBatchModal(false)}
        >
          <View style={[styles.modeModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modeModalTitle, { color: colors.text }]}>Create New Batch</Text>
            
            <View style={styles.sizeSection}>
              <Text style={[styles.sizeSectionLabel, { color: colors.textSecondary }]}>Batch Size</Text>
              <View style={styles.sizeOptions}>
                {[0.5, 1, 2, 3].map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.sizeButton,
                      { borderColor: colors.border },
                      batchSizeMultiplier === size && { 
                        backgroundColor: colors.primary,
                        borderColor: colors.primary 
                      }
                    ]}
                    onPress={() => setBatchSizeMultiplier(size)}
                  >
                    <Text style={[
                      styles.sizeButtonText,
                      { color: batchSizeMultiplier === size ? 'white' : colors.text }
                    ]}>
                      {size}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={[styles.modeSectionLabel, { color: colors.textSecondary }]}>Select Mode</Text>
            
            <TouchableOpacity 
              style={[styles.modeButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
              onPress={() => handleCreateBatch('bake-today')}
            >
              <Text style={styles.modeButtonIcon}>🟢</Text>
              <Text style={[styles.modeButtonText, { color: colors.text }]}>Bake Today</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modeButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
              onPress={() => handleCreateBatch('cold-ferment')}
            >
              <Text style={styles.modeButtonIcon}>🔵</Text>
              <Text style={[styles.modeButtonText, { color: colors.text }]}>Cold Ferment</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modeCancelButton}
              onPress={() => {
                setShowNewBatchModal(false);
                setSelectedWorkflow(null);
                setBatchSizeMultiplier(1);
              }}
            >
              <Text style={[styles.modeCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleBar: { flexDirection: 'row', borderBottomWidth: 1 },
  toggleOption: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  toggleText: { fontSize: 16, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  archiveToggleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  archiveToggleLabel: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  listContent: { paddingHorizontal: 20 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
  batchContainer: { marginBottom: 12 },
  batchCard: { borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, borderWidth: 1 },
  batchHeader: { marginBottom: 8 },
  batchName: { fontSize: 18, fontWeight: '700' },
  claimedByLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  batchInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  batchMode: { fontSize: 14 },
  batchTimer: { fontSize: 16, fontWeight: '600' },
  timerCount: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  renameInput: { fontSize: 18, fontWeight: '700', borderBottomWidth: 2, paddingVertical: 4 },
  contextMenu: { 
    position: 'absolute', 
    top: 0, 
    right: 0, 
    left: 0, 
    borderRadius: 12, 
    elevation: 999,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    zIndex: 99999,
    borderWidth: 2 
  },
  contextMenuItem: { padding: 16, borderBottomWidth: 1 },
  contextMenuText: { fontSize: 16, fontWeight: '600' },
  workflowCard: { padding: 20, borderRadius: 12, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, borderWidth: 1 },
  workflowHeader: { flexDirection: 'row', alignItems: 'center' },
  workflowName: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  workflowSteps: { fontSize: 14 },
  claimedLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  workflowContainer: { marginBottom: 12 },
  settingsButton: { position: 'absolute', bottom: 30, right: 30, width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 9999 },
  line: { width: 30, height: 4, backgroundColor: 'white', marginVertical: 3, borderRadius: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modeModal: { borderRadius: 20, padding: 24, width: '80%', maxWidth: 300 },
  modeModalTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  sizeSection: { marginBottom: 20 },
  sizeSectionLabel: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  sizeOptions: { flexDirection: 'row', gap: 8 },
  sizeButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 2, alignItems: 'center' },
  sizeButtonText: { fontSize: 16, fontWeight: '600' },
  modeSectionLabel: { fontSize: 14, marginBottom: 12, fontWeight: '600' },
  modeButton: { padding: 16, borderRadius: 12, borderWidth: 2, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeButtonIcon: { fontSize: 24 },
  modeButtonText: { fontSize: 18, fontWeight: '600' },
  modeCancelButton: { padding: 12, marginTop: 8 },
  modeCancelText: { fontSize: 16, textAlign: 'center' },
});

export default WorkflowSelectScreen;