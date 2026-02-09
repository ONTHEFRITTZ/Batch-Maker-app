import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Share, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getEnvironmentalReports,
  getBatchCompletionReports,
  getDailyReports,
  generateDailyReport,
  searchBatchReports,
  exportReportsAsJSON,
  generateBatchReportsCSV,
  generateEnvironmentalReportsCSV,
  generateDailyReportsCSV,
  deleteEnvironmentalReport,
  deleteBatchCompletionReport,
  deleteDailyReport,
  EnvironmentalReport,
  BatchCompletionReport,
  DailyReport,
} from '../../services/reports';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

type TabType = 'daily' | 'batch' | 'environmental';

export default function ReportsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [activeTab, setActiveTab] = useState<TabType>('batch');
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [batchReports, setBatchReports] = useState<BatchCompletionReport[]>([]);
  const [environmentalReports, setEnvironmentalReports] = useState<EnvironmentalReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredBatchReports, setFilteredBatchReports] = useState<BatchCompletionReport[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredBatchReports(searchBatchReports(searchQuery));
    } else {
      setFilteredBatchReports(batchReports);
    }
  }, [searchQuery, batchReports]);

  const loadReports = () => {
    setDailyReports(getDailyReports());
    setBatchReports(getBatchCompletionReports());
    setEnvironmentalReports(getEnvironmentalReports());
  };

  const handleGenerateDaily = async () => {
    try {
      await generateDailyReport();
      loadReports();
      Alert.alert('Success', 'Daily report generated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    }
  };

  const handleExportCSV = async (type: 'batch' | 'environmental' | 'daily') => {
    try {
      let csvContent = '';
      let filename = '';

      switch (type) {
        case 'batch':
          csvContent = generateBatchReportsCSV();
          filename = 'batch-reports.csv';
          break;
        case 'environmental':
          csvContent = generateEnvironmentalReportsCSV();
          filename = 'environmental-reports.csv';
          break;
        case 'daily':
          csvContent = generateDailyReportsCSV();
          filename = 'daily-reports.csv';
          break;
      }

      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export CSV',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Success', `CSV saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('CSV export error:', error);
      Alert.alert('Error', 'Failed to export CSV');
    }
  };

  const handleExport = async () => {
    Alert.alert(
      'Export Reports',
      'Choose export format',
      [
        {
          text: 'CSV - Batches',
          onPress: () => handleExportCSV('batch')
        },
        {
          text: 'CSV - Environmental',
          onPress: () => handleExportCSV('environmental')
        },
        {
          text: 'CSV - Daily',
          onPress: () => handleExportCSV('daily')
        },
        {
          text: 'JSON (Full Backup)',
          onPress: async () => {
            try {
              const json = exportReportsAsJSON();
              await Share.share({
                message: json,
                title: 'Reports Export (JSON)',
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to export JSON');
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleDeleteEnv = (id: string) => {
    Alert.alert(
      'Delete Report',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEnvironmentalReport(id);
            loadReports();
          },
        },
      ]
    );
  };

  const handleDeleteBatch = (id: string) => {
    Alert.alert(
      'Delete Report',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBatchCompletionReport(id);
            loadReports();
          },
        },
      ]
    );
  };

  const handleDeleteDaily = (id: string) => {
    Alert.alert(
      'Delete Report',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDailyReport(id);
            loadReports();
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reports</Text>
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: colors.primary }]}
          onPress={handleExport}
        >
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'daily' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
          ]}
          onPress={() => setActiveTab('daily')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'daily' ? colors.primary : colors.textSecondary }
          ]}>
            Daily
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'batch' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
          ]}
          onPress={() => setActiveTab('batch')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'batch' ? colors.primary : colors.textSecondary }
          ]}>
            Batches
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'environmental' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
          ]}
          onPress={() => setActiveTab('environmental')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'environmental' ? colors.primary : colors.textSecondary }
          ]}>
            Environmental
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'batch' && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.searchInput, { 
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border
            }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search batches..."
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      )}

      <ScrollView style={styles.content}>
        {activeTab === 'daily' && (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: colors.success }]}
              onPress={handleGenerateDaily}
            >
              <Text style={styles.generateButtonText}>Generate Today's Report</Text>
            </TouchableOpacity>

            {dailyReports.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No daily reports yet
                </Text>
              </View>
            ) : (
              dailyReports.map(report => (
                <View key={report.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {formatDate(report.timestamp)}
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        {report.totalBatches} batches completed
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteButton, { backgroundColor: colors.error }]}
                      onPress={() => handleDeleteDaily(report.id)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.statsRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Avg Duration:
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {report.averageDuration} min
                    </Text>
                  </View>

                  {Object.entries(report.batchesByWorkflow).length > 0 && (
                    <View style={styles.workflowList}>
                      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                        By Workflow:
                      </Text>
                      {Object.entries(report.batchesByWorkflow).map(([workflowId, count]) => (
                        <Text key={workflowId} style={[styles.workflowItem, { color: colors.text }]}>
                          {workflowId}: {count}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'batch' && (
          <View style={styles.tabContent}>
            {filteredBatchReports.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'No matching batches' : 'No batch reports yet'}
                </Text>
              </View>
            ) : (
              filteredBatchReports.map(report => {
                const reportDate = formatDate(report.timestamp);
                const reportTime = formatTime(report.timestamp);
                
                return (
                  <View key={report.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>
                          {report.batchName}
                        </Text>
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                          {reportDate} at {reportTime}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.deleteButton, { backgroundColor: colors.error }]}
                        onPress={() => handleDeleteBatch(report.id)}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Station:
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {report.completedBy}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Size:
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {report.batchSizeMultiplier}x
                      </Text>
                    </View>

                    {report.actualDuration && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                          Duration:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {report.actualDuration} min
                        </Text>
                      </View>
                    )}

                    {report.notes && (
                      <View style={styles.notesSection}>
                        <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                          Notes:
                        </Text>
                        <Text style={[styles.notesText, { color: colors.text }]}>
                          {report.notes}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'environmental' && (
          <View style={styles.tabContent}>
            {environmentalReports.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No environmental reports yet
                </Text>
              </View>
            ) : (
              environmentalReports.map(report => (
                <View key={report.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {formatDate(report.timestamp)}
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        {report.time} - {report.createdBy}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteButton, { backgroundColor: colors.error }]}
                      onPress={() => handleDeleteEnv(report.id)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>

                  {report.ambientTemp !== undefined && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Temperature:
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {report.ambientTemp}°C
                      </Text>
                    </View>
                  )}

                  {report.humidity !== undefined && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Humidity:
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {report.humidity}%
                      </Text>
                    </View>
                  )}

                  {report.notes && (
                    <View style={styles.notesSection}>
                      <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                        Notes:
                      </Text>
                      <Text style={[styles.notesText, { color: colors.text }]}>
                        {report.notes}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {activeTab === 'environmental' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.success }]}
          onPress={() => router.push('/screens/EnvironmentalReportScreen')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  exportButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  exportButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  tabText: { fontSize: 16, fontWeight: '600' },
  searchBar: { padding: 16 },
  searchInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  content: { flex: 1 },
  tabContent: { padding: 16 },
  generateButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  generateButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 14 },
  deleteButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  deleteButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statLabel: { fontSize: 14 },
  statValue: { fontSize: 14, fontWeight: '600' },
  workflowList: { marginTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  workflowItem: { fontSize: 14, marginLeft: 8, marginTop: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  notesSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  notesLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  notesText: { fontSize: 14, lineHeight: 20 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  fabText: { color: 'white', fontSize: 32, fontWeight: 'bold' },
});