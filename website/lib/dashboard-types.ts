export interface Workflow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  steps?: any[];
  claimed_by?: string;
  claimed_by_name?: string;
  deleted_at?: string;
}

export interface Batch {
  id: string;
  name: string;
  workflow_id: string;
  created_at: string;
  current_step_index?: number;
  steps?: any[];
  [key: string]: any;
}

export interface BatchCompletionReport {
  id: string;
  batch_id: string;
  batch_name: string;
  workflow_id: string;
  workflow_name: string;
  timestamp: number;
  date: string;
  time: string;
  completed_by: string;
  batch_size_multiplier: number;
  actual_duration?: number;
  notes?: string;
  total_cost?: number;
  yield_amount?: number;
  yield_unit?: string;
  photos?: string[];
  step_notes?: any;
  temperature_log?: any[];
  ingredients_used?: any[];
  archived?: boolean;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold?: number;
  cost_per_unit?: number;
  supplier?: string;
  category?: string;
  notes?: string;
  last_updated: string;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  user_id: string;
  item_id: string;
  batch_id?: string;
  type: 'add' | 'use' | 'adjust' | 'waste';
  quantity: number;
  cost?: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'ordered' | 'received';
  estimated_cost?: number;
  supplier?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledBatch {
  id: string;
  user_id: string;
  workflow_id: string;
  template_id?: string;
  scheduled_date: string;
  scheduled_time?: string;
  name: string;
  batch_size_multiplier: number;
  assigned_to?: string;
  assigned_to_name?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  device_name?: string;
  role?: string;
  subscription_status?: string;
}

export interface NetworkMember {
  id: string;
  user_id: string;
  network_id: string;
  role: string;
  last_active: string;
  profiles?: Profile;
}

export interface BatchTemplate {
  id: string;
  name: string;
  description?: string;
  workflow_id: string;
  workflow_name: string;
  steps: any[];
  ingredients_used?: any[];
  batch_size_multiplier: number;
  estimated_duration?: number;
  estimated_cost?: number;
  selling_price?: number;
  created_by: string;
  created_at: string;
  times_used: number;
}

export interface ActiveSession {
  user_id: string;
  device_name: string;
  current_workflow_id?: string;
  current_workflow_name?: string;
  current_batch_id?: string;
  current_step?: number;
  last_heartbeat: string;
  status: 'idle' | 'working' | 'offline';
}

export interface DashboardProps {
  user: any;
  profile: Profile | null;
  workflows: Workflow[];
  batches: Batch[];
  batchReports: BatchCompletionReport[];
  batchTemplates: BatchTemplate[];
  networkMembers: NetworkMember[];
  inventoryItems: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  shoppingList: ShoppingListItem[];
  scheduledBatches: ScheduledBatch[];
  isPremium: boolean;
  fetchInventoryItems: () => void;
  fetchInventoryTransactions: () => void;
  fetchShoppingList: () => void;
  fetchScheduledBatches: () => void;
  fetchWorkflows: () => void;
  fetchBatches: () => void;
}