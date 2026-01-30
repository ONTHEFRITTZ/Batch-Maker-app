
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { createEnvironmentalReport } from '../../services/reports';
import { getDeviceName } from '../../services/database';

export default function EnvironmentalReportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [ambientTemp, setAmbientTemp] = useState('');
  const [humidity, setHumidity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    const temp = parseFloat(ambientTemp);
    const hum = parseFloat(humidity);

    if (isNaN(temp) && isNaN(hum) && !notes.trim()) {
      Alert.alert('Error', 'Please enter at least one value');
      return;
    }

    try {
      const deviceName = await getDeviceName();
      
      await createEnvironmentalReport(
        deviceName,
        isNaN(temp) ? undefined : temp,
        isNaN(hum) ? undefined : hum,
        notes.trim() || undefined
      );

      Alert.alert('Success', 'Environmental report saved!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        }
      ]);
    } catch (error) {
      console.error('Error saving report:', error);
      Alert.alert('Error', 'Failed to save report');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Start of Day Report</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Record environmental conditions for quality control
        </Text>

        {/* Temperature */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Ambient Temperature (°C)</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.surface, 
              color: colors.text,
              borderColor: colors.border 
            }]}
            value={ambientTemp}
            onChangeText={setAmbientTemp}
            placeholder="e.g., 22"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Humidity */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Humidity (%)</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.surface, 
              color: colors.text,
              borderColor: colors.border 
            }]}
            value={humidity}
            onChangeText={setHumidity}
            placeholder="e.g., 65"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
          <TextInput
            style={[styles.textArea, { 
              backgroundColor: colors.surface, 
              color: colors.text,
              borderColor: colors.border 
            }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Weather conditions, any unusual observations..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Info Box */}
        <View style={[styles.infoBox, { 
          backgroundColor: colors.primary + '15', 
          borderColor: colors.primary 
        }]}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>Why Track This?</Text>
          <Text style={[styles.infoText, { color: colors.text }]}>
            Environmental conditions affect dough behavior, rising times, and final product quality. 
            This data helps maintain consistency and troubleshoot issues.
          </Text>
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
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.success }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
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
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});