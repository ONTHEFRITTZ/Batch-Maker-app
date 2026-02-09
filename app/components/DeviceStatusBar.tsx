import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { syncService, Device } from '../../services/sync';

export default function DeviceStatusBar() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.onDevicesChange((newDevices) => {
      setDevices(newDevices);
    });

    // Initial load
    setDevices(syncService.getConnectedDevices());

    return unsubscribe;
  }, []);

  const isHost = syncService.isHostDevice();
  const deviceCount = devices.length;

  return (
    <>
      <TouchableOpacity 
        style={styles.statusBar}
        onPress={() => setModalVisible(true)}
      >
        <View style={[styles.statusDot, isHost ? styles.hostDot : styles.clientDot]} />
        <Text style={styles.statusText}>
          {deviceCount} {deviceCount === 1 ? 'Device' : 'Devices'} {isHost ? '(Host)' : ''}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Connected Devices</Text>
            
            {devices.map(device => (
              <View key={device.id} style={styles.deviceItem}>
                <View style={[
                  styles.deviceDot,
                  device.isHost ? styles.hostDot : styles.clientDot
                ]} />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  {device.isHost && (
                    <Text style={styles.deviceRole}>Host</Text>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  hostDot: {
    backgroundColor: '#28a745',
  },
  clientDot: {
    backgroundColor: '#007AFF',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deviceRole: {
    fontSize: 12,
    color: '#28a745',
    marginTop: 2,
  },
  closeButton: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

