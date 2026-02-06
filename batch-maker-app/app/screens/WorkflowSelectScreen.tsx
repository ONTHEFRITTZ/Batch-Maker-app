import { useRouter } from "expo-router";
import React, { FC, useEffect, useState } from "react";
import { 
  FlatList, Text, View, TouchableOpacity, StyleSheet, Alert,
  TextInput, Modal, Animated, ScrollView
} from "react-native";
import { 
  getWorkflows, getBatches, createBatch, duplicateBatch, 
  renameBatch, deleteBatch, batchHasProgress, getMostUrgentTimer,
  batchHasExpiredTimer, getTimerStatus, formatTimeRemaining,
  claimWorkflow, unclaimWorkflow, getClaimedWorkflows, getUnclaimedWorkflows,
  isWorkflowClaimedByMe,
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
  onSelectWorkflow: (id: string) => void;
}> = ({ item, colors, hasActiveBatches, isClaimed, onSelectWorkflow }) => {
  return (
    <View style={styles.workflowContainer}>
      <TouchableOpacity
        style={[styles.workflowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => onSelectWorkflow(item.id)}
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
  const [renamingBatch, setRenamingBatch] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [showMyWorkflows, setShowMyWorkflows] = useState(false);
  const [displayedWorkflows, setDisplayedWorkflows] = useState<Workflow[]>([]);
  const [batchSizeMultiplier, setBatchSizeMultiplier] = useState(1);
  const [showEditSelector, setShowEditSelector] = useState(false);
  
  const [claimedStatus, setClaimedStatus] = useState<Map<string, boolean>>(new Map());

  // Filter batches to only show claimed ones on My Workflows tab
  const [displayedBatches, setDisplayedBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const freshBatches = getBatches();
      setBatches([...freshBatches]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const allWorkflows = getWorkflows();
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
    if (!showMyWorkflows) {
      setDisplayedWorkflows(workflows);
    }
  }, [showMyWorkflows, workflows, claimedStatus]);

  // CRITICAL FIX: Filter batches based on tab
  useEffect(() => {
    if (showMyWorkflows) {
      // Only show batches where the workflow is claimed by me
      const myBatches = batches.filter(batch => {
        const isClaimed = claimedStatus.get(batch.workflowId) || false;
        return isClaimed;
      });
      setDisplayedBatches(myBatches);
    } else {
      // Show all batches on All Workflows tab
      setDisplayedBatches(batches);
    }
  }, [showMyWorkflows, batches, claimedStatus]);

  const handleCreateBatch = async (mode: 'bake-today' | 'cold-ferment') => {
    if (!selectedWorkflow) return;
    
    await createBatch(selectedWorkflow, mode, 1, batchSizeMultiplier);
    setShowNewBatchModal(false);
    setSelectedWorkflow(null);
    setBatchSizeMultiplier(1);
    loadData();
  };

  const handleDuplicateBatch = async (batchId: string) => {
    await duplicateBatch(batchId);
    setContextMenuBatch(null);
    loadData();
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
              loadData();
            }
          }
        ]
      );
    } else {
      await deleteBatch(batchId);
      setContextMenuBatch(null);
      loadData();
    }
  };

  const handleRenameBatch = async (batchId: string) => {
    if (renameText.trim()) {
      await renameBatch(batchId, renameText.trim());
      setRenamingBatch(null);
      setRenameText("");
      loadData();
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
    setSelectedWorkflow(workflowId);
    setShowNewBatchModal(true);
  };

  const handleEditWorkflow = (workflowId: string) => {
    setShowEditSelector(false);
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

  const renderWorkflow = ({ item }: { item: Workflow }) => {
    const isClaimed = claimedStatus.get(item.id) || false;
    const hasActiveBatches = batches.some(b => b.workflowId === item.id);
    
    return (
      <WorkflowItem
        item={item}
        colors={colors}
        hasActiveBatches={hasActiveBatches}
        isClaimed={isClaimed}
        onSelectWorkflow={handleSelectWorkflow}
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
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowEditSelector(true)}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {displayedWorkflows.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No workflows yet
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Tap settings to import
                </Text>
              </View>
            ) : (
              <View style={styles.listContent}>
                {displayedWorkflows.map(item => (
                  <View key={item.id}>
                    {renderWorkflow({ item })}
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
        visible={showEditSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditSelector(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditSelector(false)}
        >
          <View style={[styles.editModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.editModalTitle, { color: colors.text }]}>Select Workflow to Edit</Text>
            
            <ScrollView style={styles.editModalScroll}>
              {workflows.map(workflow => (
                <TouchableOpacity
                  key={workflow.id}
                  style={[styles.editModalItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleEditWorkflow(workflow.id)}
                >
                  <Text style={[styles.editModalItemText, { color: colors.text }]}>
                    {workflow.name}
                  </Text>
                  <Text style={[styles.editModalItemSteps, { color: colors.textSecondary }]}>
                    {workflow.steps.length} steps
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.editModalCancel}
              onPress={() => setShowEditSelector(false)}
            >
              <Text style={[styles.editModalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
  editButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  editButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  listContent: { paddingHorizontal: 20 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
  // FIXED: Remove zIndex from container
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
  // FIXED: Massively increased elevation and zIndex
  contextMenu: { 
    position: 'absolute', 
    top: 0, 
    right: 0, 
    left: 0, 
    borderRadius: 12, 
    elevation: 999,  // Changed from 10 to 999
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 },  // Increased shadow
    shadowOpacity: 0.5,  // Increased opacity
    shadowRadius: 12,  // Increased radius
    zIndex: 99999,  // Changed from 9999 to 99999
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
  editModal: { borderRadius: 20, padding: 24, width: '85%', maxHeight: '70%' },
  editModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  editModalScroll: { maxHeight: 400 },
  editModalItem: { paddingVertical: 16, borderBottomWidth: 1 },
  editModalItemText: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  editModalItemSteps: { fontSize: 14 },
  editModalCancel: { marginTop: 16, padding: 12 },
  editModalCancelText: { fontSize: 16, textAlign: 'center' },
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