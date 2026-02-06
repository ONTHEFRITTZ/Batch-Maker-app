import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { syncService } from '../../services/sync';

interface DeviceNameModalProps {
  visible: boolean;
  onComplete: () => void;
}

export default function DeviceNameModal({ visible, onComplete }: DeviceNameModalProps) {
  const [name, setName] = useState('');

  const handleSave = async () => {
    if (name.trim()) {
      await syncService.setDeviceName(name.trim());
      onComplete();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Name This Device</Text>
          <Text style={styles.modalSubtitle}>
            Give this device a name so others can identify it
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Oven Station 1"
            placeholderTextColor="#999"
            autoFocus
          />

          <View style={styles.suggestions}>
            <Text style={styles.suggestionsLabel}>Suggestions:</Text>
            <View style={styles.suggestionButtons}>
              {['Oven Station', 'Prep Table', 'Packaging', 'Display'].map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionButton}
                  onPress={() => setName(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!name.trim()}
          >
            <Text style={styles.saveButtonText}>Save & Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 24,
  },
  suggestions: {
    marginBottom: 24,
  },
  suggestionsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  suggestionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});