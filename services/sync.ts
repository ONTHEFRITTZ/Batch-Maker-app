import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = '@device_id';
const DEVICE_NAME_KEY = '@device_name';
const HOST_PORT = 3000;

export interface Device {
  id: string;
  name: string;
  isHost: boolean;
  lastSeen: number;
}

export interface SyncMessage {
  type: 'batch_update' | 'batch_delete' | 'batch_create' | 'heartbeat';
  deviceId: string;
  timestamp: number;
  data?: any;
}

class SyncService {
  private deviceId: string = '';
  private deviceName: string = '';
  private isHost: boolean = false;
  private connectedDevices: Map<string, Device> = new Map();
  private listeners: Set<(devices: Device[]) => void> = new Set();
  private dataListeners: Set<(message: SyncMessage) => void> = new Set();
  private maxSeats: number = 5;
  private hostConnection: any = null;
  private heartbeatInterval: any = null;

  async initialize(): Promise<void> {
    let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!storedId) {
      storedId = uuidv4(); // FIXED: Generate proper UUID
      await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
    }
    this.deviceId = storedId; // TypeScript now knows this is a string

    const storedName = await AsyncStorage.getItem(DEVICE_NAME_KEY);
    this.deviceName = storedName ?? 'Unnamed Device'; // FIXED: Use nullish coalescing
  }

  async setDeviceName(name: string): Promise<void> {
    this.deviceName = name;
    await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
    this.broadcastDeviceUpdate();
  }

  getDeviceName(): string {
    return this.deviceName;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  isHostDevice(): boolean {
    return this.isHost;
  }

  async startHost(maxSeats: number): Promise<void> {
    console.log(`Device ${this.deviceId} starting as host with ${maxSeats} seats`);
    this.isHost = true;
    this.maxSeats = maxSeats;

    this.connectedDevices.set(this.deviceId, {
      id: this.deviceId,
      name: this.deviceName,
      isHost: true,
      lastSeen: Date.now(),
    });

    this.startHeartbeat();
    this.notifyListeners();
  }

  async stopHost(): Promise<void> {
    console.log('Stopping host');
    this.isHost = false;
    this.stopHeartbeat();
    this.connectedDevices.clear();
    this.notifyListeners();
  }

  async connectToHost(hostIP: string): Promise<boolean> {
    console.log(`Attempting to connect to host at ${hostIP}`);
    
    try {
      // Simulate connection for now
      // In real implementation, you'd use WebSocket or HTTP polling
      
      this.isHost = false;
      this.hostConnection = hostIP;
      
      // Add ourselves as a connected device
      this.connectedDevices.set(this.deviceId, {
        id: this.deviceId,
        name: this.deviceName,
        isHost: false,
        lastSeen: Date.now(),
      });

      // Simulate host device
      this.connectedDevices.set('host_device', {
        id: 'host_device',
        name: 'Host',
        isHost: true,
        lastSeen: Date.now(),
      });

      this.startHeartbeat();
      this.notifyListeners();
      
      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from host');
    this.hostConnection = null;
    this.stopHeartbeat();
    this.connectedDevices.clear();
    this.notifyListeners();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      const ourDevice = this.connectedDevices.get(this.deviceId);
      if (ourDevice) {
        ourDevice.lastSeen = now;
      }

      if (this.isHost) {
        let devicesChanged = false;
        this.connectedDevices.forEach((device, id) => {
          if (id !== this.deviceId && now - device.lastSeen > 10000) {
            this.connectedDevices.delete(id);
            devicesChanged = true;
          }
        });

        if (devicesChanged) {
          this.broadcastDeviceList();
        }
      }

      this.broadcast({
        type: 'heartbeat',
        deviceId: this.deviceId,
        timestamp: now,
      });
    }, 3000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  broadcast(message: SyncMessage): void {
    if (this.isHost) {
      console.log('Host broadcasting:', message.type);
    } else if (this.hostConnection) {
      console.log('Client broadcasting to host:', message.type);
    }

    this.notifyDataListeners(message);
  }

  private broadcastDeviceList(): void {
    const devices = Array.from(this.connectedDevices.values());
    console.log('Broadcasting device list:', devices.length);
    this.notifyListeners();
  }

  private broadcastDeviceUpdate(): void {
    const device = this.connectedDevices.get(this.deviceId);
    if (device) {
      device.name = this.deviceName;
      this.broadcastDeviceList();
    }
  }

  getConnectedDevices(): Device[] {
    return Array.from(this.connectedDevices.values());
  }

  getAvailableSeats(): number {
    if (!this.isHost) return 0;
    return this.maxSeats - this.connectedDevices.size;
  }

  canAcceptConnection(): boolean {
    if (!this.isHost) return false;
    return this.connectedDevices.size < this.maxSeats;
  }

  onDevicesChange(callback: (devices: Device[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onDataSync(callback: (message: SyncMessage) => void): () => void {
    this.dataListeners.add(callback);
    return () => this.dataListeners.delete(callback);
  }

  private notifyListeners(): void {
    const devices = this.getConnectedDevices();
    this.listeners.forEach(callback => callback(devices));
  }

  private notifyDataListeners(message: SyncMessage): void {
    this.dataListeners.forEach(callback => callback(message));
  }

  async shutdown(): Promise<void> {
    this.stopHeartbeat();
    this.hostConnection = null;
    this.connectedDevices.clear();
    this.notifyListeners();
  }
}

export const syncService = new SyncService();