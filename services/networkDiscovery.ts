// ============================================
// FILE: services/networkDiscovery.ts
// Local network discovery for multi-device sync
// ============================================

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@device_id';
const DEVICE_NAME_KEY = '@device_name';
const CONNECTED_HOST_KEY = '@connected_host';
const DISCOVERY_PORT = 3000;

export interface NetworkHost {
  id: string;
  name: string;
  businessName: string;
  ip: string;
  port: number;
  lastSeen: number;
  isHost: boolean;
  deviceCount?: number;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  lastSeen: number;
  isHost: boolean;
}

class NetworkDiscoveryService {
  private deviceId: string = '';
  private deviceName: string = '';
  private discoveredDevices: Map<string, DiscoveredDevice> = new Map();
  private discoveredHosts: Map<string, NetworkHost> = new Map();
  private connectedHost: NetworkHost | null = null;
  private deviceListeners: Set<(devices: DiscoveredDevice[]) => void> = new Set();
  private hostListeners: Set<(hosts: NetworkHost[]) => void> = new Set();
  private discoveryInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the network discovery service
   */
  async initialize(): Promise<void> {
    try {
      // Get or create device ID
      let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!storedId) {
        storedId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
      }
      this.deviceId = storedId;

      // Get device name
      const storedName = await AsyncStorage.getItem(DEVICE_NAME_KEY);
      this.deviceName = storedName || 'Unnamed Device';

      // Load connected host
      const storedHost = await AsyncStorage.getItem(CONNECTED_HOST_KEY);
      if (storedHost) {
        this.connectedHost = JSON.parse(storedHost);
      }

      console.log('✅ Network discovery initialized');
      console.log(`   Device ID: ${this.deviceId}`);
      console.log(`   Device Name: ${this.deviceName}`);
      if (this.connectedHost) {
        console.log(`   Connected to: ${this.connectedHost.businessName}`);
      }
    } catch (error) {
      console.error('❌ Error initializing network discovery:', error);
      throw error;
    }
  }

  /**
   * Start discovering devices and hosts on the local network
   */
  startDiscovery(): void {
    if (this.discoveryInterval) {
      console.log('⚠️ Discovery already running');
      return;
    }

    console.log('🔍 Starting network discovery...');

    // Mock discovery for now - in production, this would use:
    // - iOS: Network.framework / Bonjour
    // - Android: Network Service Discovery (NSD)
    this.discoveryInterval = setInterval(() => {
      this.performDiscovery();
    }, 5000); // Every 5 seconds

    // Initial discovery
    this.performDiscovery();
  }

  /**
   * Stop discovering devices
   */
  stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
      console.log('🛑 Network discovery stopped');
    }
  }

  /**
   * Perform a single discovery scan
   * NOTE: This is a mock implementation
   * In production, you'd use native modules for actual network scanning
   */
  private async performDiscovery(): Promise<void> {
    try {
      // Mock: Add self as a discovered device
      const selfDevice: DiscoveredDevice = {
        id: this.deviceId,
        name: this.deviceName,
        ip: '127.0.0.1', // Localhost
        port: DISCOVERY_PORT,
        lastSeen: Date.now(),
        isHost: false,
      };

      this.discoveredDevices.set(this.deviceId, selfDevice);

      // Mock: Simulate discovering a host (for demo purposes)
      // In production, this would come from actual network scanning
      if (Math.random() > 0.7) { // 30% chance to "discover" a host
        const mockHost: NetworkHost = {
          id: 'demo_host_1',
          name: 'Demo Network Host',
          businessName: 'Demo Bakery',
          ip: '192.168.1.100',
          port: DISCOVERY_PORT,
          lastSeen: Date.now(),
          isHost: true,
          deviceCount: 3,
        };
        this.discoveredHosts.set(mockHost.id, mockHost);
      }

      // Clean up stale devices (not seen in 30 seconds)
      const now = Date.now();
      const staleThreshold = 30000;

      this.discoveredDevices.forEach((device, id) => {
        if (now - device.lastSeen > staleThreshold && id !== this.deviceId) {
          this.discoveredDevices.delete(id);
          console.log(`🗑️ Removed stale device: ${device.name}`);
        }
      });

      this.discoveredHosts.forEach((host, id) => {
        if (now - host.lastSeen > staleThreshold) {
          this.discoveredHosts.delete(id);
          console.log(`🗑️ Removed stale host: ${host.businessName}`);
        }
      });

      // Notify listeners
      this.notifyDeviceListeners();
      this.notifyHostListeners();
    } catch (error) {
      console.error('❌ Error during discovery:', error);
    }
  }

  /**
   * Connect to a network host
   */
  async connectToHost(hostId: string): Promise<boolean> {
    const host = this.discoveredHosts.get(hostId);
    if (!host) {
      console.error('❌ Host not found:', hostId);
      return false;
    }

    try {
      this.connectedHost = host;
      await AsyncStorage.setItem(CONNECTED_HOST_KEY, JSON.stringify(host));
      console.log(`✅ Connected to host: ${host.businessName}`);
      this.notifyHostListeners();
      return true;
    } catch (error) {
      console.error('❌ Error connecting to host:', error);
      return false;
    }
  }

  /**
   * Disconnect from current host
   */
  async disconnectFromHost(): Promise<void> {
    this.connectedHost = null;
    await AsyncStorage.removeItem(CONNECTED_HOST_KEY);
    console.log('🔌 Disconnected from host');
    this.notifyHostListeners();
  }

  /**
   * Get currently connected host
   */
  getConnectedHost(): NetworkHost | null {
    return this.connectedHost;
  }

  /**
   * Get all discovered hosts
   */
  getDiscoveredHosts(): NetworkHost[] {
    return Array.from(this.discoveredHosts.values());
  }

  /**
   * Get all discovered devices
   */
  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get current device info
   */
  getCurrentDevice(): DiscoveredDevice | null {
    return this.discoveredDevices.get(this.deviceId) || null;
  }

  /**
   * Subscribe to device list updates
   */
  onDevicesChanged(callback: (devices: DiscoveredDevice[]) => void): () => void {
    this.deviceListeners.add(callback);
    
    // Immediately call with current devices
    callback(this.getDiscoveredDevices());

    // Return unsubscribe function
    return () => {
      this.deviceListeners.delete(callback);
    };
  }

  /**
   * Subscribe to host list updates
   */
  onHostsChanged(callback: (hosts: NetworkHost[]) => void): () => void {
    this.hostListeners.add(callback);
    
    // Immediately call with current hosts
    callback(this.getDiscoveredHosts());

    // Return unsubscribe function
    return () => {
      this.hostListeners.delete(callback);
    };
  }

  /**
   * Manually add a device (for testing or manual connection)
   */
  addDevice(device: DiscoveredDevice): void {
    this.discoveredDevices.set(device.id, {
      ...device,
      lastSeen: Date.now(),
    });
    this.notifyDeviceListeners();
    console.log(`➕ Added device: ${device.name} (${device.ip})`);
  }

  /**
   * Manually add a host (for testing)
   */
  addHost(host: NetworkHost): void {
    this.discoveredHosts.set(host.id, {
      ...host,
      lastSeen: Date.now(),
    });
    this.notifyHostListeners();
    console.log(`➕ Added host: ${host.businessName} (${host.ip})`);
  }

  /**
   * Remove a device from discovered list
   */
  removeDevice(deviceId: string): void {
    if (this.discoveredDevices.delete(deviceId)) {
      this.notifyDeviceListeners();
      console.log(`➖ Removed device: ${deviceId}`);
    }
  }

  /**
   * Notify all device listeners
   */
  private notifyDeviceListeners(): void {
    const devices = this.getDiscoveredDevices();
    this.deviceListeners.forEach(callback => {
      try {
        callback(devices);
      } catch (error) {
        console.error('❌ Error in device listener:', error);
      }
    });
  }

  /**
   * Notify all host listeners
   */
  private notifyHostListeners(): void {
    const hosts = this.getDiscoveredHosts();
    this.hostListeners.forEach(callback => {
      try {
        callback(hosts);
      } catch (error) {
        console.error('❌ Error in host listener:', error);
      }
    });
  }

  /**
   * Set device name
   */
  async setDeviceName(name: string): Promise<void> {
    this.deviceName = name;
    await AsyncStorage.setItem(DEVICE_NAME_KEY, name);

    // Update self in discovered devices
    const selfDevice = this.discoveredDevices.get(this.deviceId);
    if (selfDevice) {
      selfDevice.name = name;
      this.notifyDeviceListeners();
    }

    console.log(`✏️ Device name updated: ${name}`);
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Get device name
   */
  getDeviceName(): string {
    return this.deviceName;
  }

  /**
   * Check if a specific device is online
   */
  isDeviceOnline(deviceId: string): boolean {
    const device = this.discoveredDevices.get(deviceId);
    if (!device) return false;

    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds
    return (now - device.lastSeen) < staleThreshold;
  }

  /**
   * Check if connected to a host
   */
  isConnected(): boolean {
    return this.connectedHost !== null;
  }

  /**
   * Clean up and shutdown
   */
  shutdown(): void {
    this.stopDiscovery();
    this.discoveredDevices.clear();
    this.discoveredHosts.clear();
    this.deviceListeners.clear();
    this.hostListeners.clear();
    console.log('🛑 Network discovery service shut down');
  }
}

// Export singleton instance
export const networkDiscovery = new NetworkDiscoveryService();

// Export for direct imports
export default networkDiscovery;