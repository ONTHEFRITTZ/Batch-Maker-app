'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';


interface Workflow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  steps?: any[];
  claimed_by?: string;
  claimed_by_name?: string;
  deleted_at?: string;
}

interface Batch {
  id: string;
  name: string;
  workflow_id: string;
  created_at: string;
  current_step_index?: number;
  steps?: any[];
  [key: string]: any;
}

interface BatchCompletionReport {
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

interface InventoryItem {
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

interface InventoryTransaction {
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

interface ShoppingListItem {
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

interface ScheduledBatch {
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

interface Profile {
  id: string;
  email: string;
  device_name?: string;
  role?: string;
  subscription_status?: string;
}

interface NetworkMember {
  id: string;
  user_id: string;
  network_id: string;
  role: string;
  last_active: string;
  profiles?: Profile;
}

interface BatchTemplate {
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

export default function EnhancedDashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchReports, setBatchReports] = useState<BatchCompletionReport[]>([]);
  const [batchTemplates, setBatchTemplates] = useState<BatchTemplate[]>([]);
  const [networkMembers, setNetworkMembers] = useState<NetworkMember[]>([]);
  
  // New state for inventory
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  
  // New state for calendar
  const [scheduledBatches, setScheduledBatches] = useState<ScheduledBatch[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [loading, setLoading] = useState(true);
  
  // View states
  const [activeView, setActiveView] = useState<'overview' | 'inventory' | 'calendar' | 'analytics'>('overview');
  
  // Modal states
  const [addInventoryModalOpen, setAddInventoryModalOpen] = useState(false);
  const [addShoppingItemModalOpen, setAddShoppingItemModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [inventoryTransactionModalOpen, setInventoryTransactionModalOpen] = useState(false);
  
  // Form states
  const [inventoryFormData, setInventoryFormData] = useState({
    name: '',
    quantity: 0,
    unit: 'kg',
    low_stock_threshold: 0,
    cost_per_unit: 0,
    supplier: '',
    category: '',
    notes: '',
  });
  
  const [shoppingFormData, setShoppingFormData] = useState({
    item_name: '',
    quantity: 0,
    unit: 'kg',
    priority: 'normal' as 'urgent' | 'high' | 'normal' | 'low',
    estimated_cost: 0,
    supplier: '',
    notes: '',
  });
  
  const [scheduleFormData, setScheduleFormData] = useState({
    workflow_id: '',
    template_id: '',
    scheduled_date: '',
    scheduled_time: '',
    name: '',
    batch_size_multiplier: 1,
    assigned_to: '',
    notes: '',
  });
  
  const [transactionFormData, setTransactionFormData] = useState({
    item_id: '',
    type: 'use' as 'add' | 'use' | 'adjust' | 'waste',
    quantity: 0,
    cost: 0,
    notes: '',
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Real-time subscriptions
    const inventoryChannel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `user_id=eq.${user.id}` }, 
        () => fetchInventoryItems(user.id))
      .subscribe();

    const scheduledChannel = supabase
      .channel('scheduled-batches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_batches', filter: `user_id=eq.${user.id}` }, 
        () => fetchScheduledBatches(user.id))
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(scheduledChannel);
    };
  }, [user]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      window.location.href = '/login';
      return;
    }

    setUser(session.user);
    await fetchData(session.user.id);
  }

  async function fetchData(userId: string) {
    try {
      await Promise.all([
        fetchProfile(userId),
        fetchWorkflows(userId),
        fetchBatches(userId),
        fetchBatchReports(userId),
        fetchBatchTemplates(userId),
        fetchInventoryItems(userId),
        fetchInventoryTransactions(userId),
        fetchShoppingList(userId),
        fetchScheduledBatches(userId),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfile(userId: string) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    setProfile(profileData);

    const isPremium = profileData?.role === 'premium' || profileData?.role === 'admin';
    if (isPremium) {
      const { data: networkData } = await supabase
        .from('networks')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (networkData) {
        const { data: membersData } = await supabase
          .from('network_members')
          .select(`*, profiles:user_id (id, email, device_name)`)
          .eq('network_id', networkData.id);

        setNetworkMembers(membersData || []);
      }
    }
  }

  async function fetchWorkflows(userId: string) {
    const { data } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setWorkflows(data || []);
  }

  async function fetchBatches(userId: string) {
    const { data } = await supabase
      .from('batches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setBatches(data || []);
  }

  async function fetchBatchReports(userId: string) {
    const { data } = await supabase
      .from('batch_completion_reports')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });
    setBatchReports(data || []);
  }

  async function fetchBatchTemplates(userId: string) {
    const { data } = await supabase
      .from('batch_templates')
      .select('*')
      .eq('created_by', userId)
      .order('times_used', { ascending: false });
    setBatchTemplates(data || []);
  }

  // Inventory functions
  async function fetchInventoryItems(userId: string) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    
    if (error) console.error('Error fetching inventory:', error);
    else setInventoryItems(data || []);
  }

  async function fetchInventoryTransactions(userId: string) {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) console.error('Error fetching transactions:', error);
    else setInventoryTransactions(data || []);
  }

  async function fetchShoppingList(userId: string) {
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching shopping list:', error);
    else setShoppingList(data || []);
  }

  async function fetchScheduledBatches(userId: string) {
    const { data, error } = await supabase
      .from('scheduled_batches')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_date');
    
    if (error) console.error('Error fetching scheduled batches:', error);
    else setScheduledBatches(data || []);
  }

  async function handleAddInventoryItem() {
    if (!inventoryFormData.name || inventoryFormData.quantity <= 0) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase.from('inventory_items').insert({
        user_id: user.id,
        ...inventoryFormData,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      await fetchInventoryItems(user.id);
      setAddInventoryModalOpen(false);
      setInventoryFormData({
        name: '', quantity: 0, unit: 'kg', low_stock_threshold: 0,
        cost_per_unit: 0, supplier: '', category: '', notes: '',
      });
      alert('Inventory item added successfully!');
    } catch (error) {
      console.error('Error adding inventory:', error);
      alert('Failed to add inventory item');
    }
  }

  async function handleInventoryTransaction() {
    if (!transactionFormData.item_id || transactionFormData.quantity <= 0) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const item = inventoryItems.find(i => i.id === transactionFormData.item_id);
      if (!item) throw new Error('Item not found');

      let newQuantity = item.quantity;
      if (transactionFormData.type === 'use' || transactionFormData.type === 'waste') {
        newQuantity -= transactionFormData.quantity;
      } else if (transactionFormData.type === 'add') {
        newQuantity += transactionFormData.quantity;
      } else {
        newQuantity = transactionFormData.quantity;
      }

      // Insert transaction
      const { error: transError } = await supabase.from('inventory_transactions').insert({
        user_id: user.id,
        item_id: transactionFormData.item_id,
        type: transactionFormData.type,
        quantity: transactionFormData.quantity,
        cost: transactionFormData.cost || null,
        notes: transactionFormData.notes,
        created_by: user.email,
        created_at: new Date().toISOString(),
      });

      if (transError) throw transError;

      // Update item quantity
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ 
          quantity: newQuantity,
          last_updated: new Date().toISOString()
        })
        .eq('id', transactionFormData.item_id);

      if (updateError) throw updateError;

      await fetchInventoryItems(user.id);
      await fetchInventoryTransactions(user.id);
      setInventoryTransactionModalOpen(false);
      setTransactionFormData({ item_id: '', type: 'use', quantity: 0, cost: 0, notes: '' });
      alert('Transaction recorded successfully!');
    } catch (error) {
      console.error('Error recording transaction:', error);
      alert('Failed to record transaction');
    }
  }

  async function handleAddShoppingItem() {
    if (!shoppingFormData.item_name || shoppingFormData.quantity <= 0) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase.from('shopping_list').insert({
        user_id: user.id,
        ...shoppingFormData,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      await fetchShoppingList(user.id);
      setAddShoppingItemModalOpen(false);
      setShoppingFormData({
        item_name: '', quantity: 0, unit: 'kg', priority: 'normal',
        estimated_cost: 0, supplier: '', notes: '',
      });
      alert('Item added to shopping list!');
    } catch (error) {
      console.error('Error adding shopping item:', error);
      alert('Failed to add shopping item');
    }
  }

  async function updateShoppingItemStatus(id: string, status: 'pending' | 'ordered' | 'received') {
    const { error } = await supabase
      .from('shopping_list')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) await fetchShoppingList(user.id);
  }

  async function handleScheduleBatch() {
    if (!scheduleFormData.workflow_id || !scheduleFormData.scheduled_date || !scheduleFormData.name) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const assignedMember = networkMembers.find(m => m.user_id === scheduleFormData.assigned_to);
      
      const { error } = await supabase.from('scheduled_batches').insert({
        user_id: user.id,
        workflow_id: scheduleFormData.workflow_id,
        template_id: scheduleFormData.template_id || null,
        scheduled_date: scheduleFormData.scheduled_date,
        scheduled_time: scheduleFormData.scheduled_time || null,
        name: scheduleFormData.name,
        batch_size_multiplier: scheduleFormData.batch_size_multiplier,
        assigned_to: scheduleFormData.assigned_to || null,
        assigned_to_name: assignedMember ? (assignedMember.profiles?.device_name || assignedMember.profiles?.email) : null,
        status: 'scheduled',
        notes: scheduleFormData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      await fetchScheduledBatches(user.id);
      setScheduleModalOpen(false);
      setScheduleFormData({
        workflow_id: '', template_id: '', scheduled_date: '', scheduled_time: '',
        name: '', batch_size_multiplier: 1, assigned_to: '', notes: '',
      });
      alert('Batch scheduled successfully!');
    } catch (error) {
      console.error('Error scheduling batch:', error);
      alert('Failed to schedule batch');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading Enhanced Dashboard...</div>
      </div>
    );
  }

  const isPremium = profile?.role === 'premium' || profile?.role === 'admin';

  // Analytics calculations
  const lowStockItems = inventoryItems.filter(item => 
    item.low_stock_threshold && item.quantity <= item.low_stock_threshold
  );
  
  const totalInventoryValue = inventoryItems.reduce((sum, item) => 
    sum + (item.quantity * (item.cost_per_unit || 0)), 0
  );

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const recentReports = batchReports.filter(r => new Date(r.timestamp) >= last30Days);
  
  const totalRevenue30d = recentReports.reduce((sum, r) => {
    const template = batchTemplates.find(t => t.workflow_name === r.workflow_name);
    return sum + ((template?.selling_price || 0) * r.batch_size_multiplier);
  }, 0);
  
  const totalCost30d = recentReports.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const profit30d = totalRevenue30d - totalCost30d;
  const profitMargin30d = totalRevenue30d > 0 ? (profit30d / totalRevenue30d) * 100 : 0;

  // Calendar data
  const getCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const calendarDays = getCalendarDays();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const getBatchesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return scheduledBatches.filter(b => b.scheduled_date === dateStr);
  };

  // Workflow popularity
  const workflowStats = batchReports.reduce((acc, r) => {
    if (!acc[r.workflow_name]) {
      acc[r.workflow_name] = { count: 0, totalDuration: 0, totalCost: 0 };
    }
    acc[r.workflow_name].count++;
    acc[r.workflow_name].totalDuration += r.actual_duration || 0;
    acc[r.workflow_name].totalCost += r.total_cost || 0;
    return acc;
  }, {} as Record<string, { count: number; totalDuration: number; totalCost: number }>);

  const topWorkflows = Object.entries(workflowStats)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      avgDuration: stats.totalDuration / stats.count / 60,
      avgCost: stats.totalCost / stats.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>Enhanced Dashboard</h1>
            {isPremium && <p style={styles.premiumBadge}>👑 Premium Account</p>}
          </div>
          <div style={styles.headerButtons}>
            <Link href="/account" style={styles.linkButton}>Account</Link>
            <button onClick={signOut} style={styles.signOutButton}>Sign Out</button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div style={styles.tabBar}>
        <button 
          style={{...styles.tab, ...(activeView === 'overview' ? styles.tabActive : {})}}
          onClick={() => setActiveView('overview')}
        >
          📊 Overview
        </button>
        <button 
          style={{...styles.tab, ...(activeView === 'inventory' ? styles.tabActive : {})}}
          onClick={() => setActiveView('inventory')}
        >
          📦 Inventory
        </button>
        <button 
          style={{...styles.tab, ...(activeView === 'calendar' ? styles.tabActive : {})}}
          onClick={() => setActiveView('calendar')}
        >
          📅 Calendar
        </button>
        <button 
          style={{...styles.tab, ...(activeView === 'analytics' ? styles.tabActive : {})}}
          onClick={() => setActiveView('analytics')}
        >
          📈 Analytics
        </button>
      </div>

      <div style={styles.content}>
        {/* OVERVIEW VIEW */}
        {activeView === 'overview' && (
          <>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{workflows.length}</div>
                <div style={styles.statLabel}>Workflows</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{inventoryItems.length}</div>
                <div style={styles.statLabel}>Inventory Items</div>
              </div>
              <div style={styles.statCard}>
                <div style={{...styles.statNumber, color: lowStockItems.length > 0 ? '#ef4444' : '#10b981'}}>
                  {lowStockItems.length}
                </div>
                <div style={styles.statLabel}>Low Stock Alerts</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{scheduledBatches.filter(b => b.status === 'scheduled').length}</div>
                <div style={styles.statLabel}>Scheduled Batches</div>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>30-Day Performance</h2>
              <div style={styles.analyticsGrid}>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Batches Completed</div>
                  <div style={styles.analyticValue}>{recentReports.length}</div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Total Revenue</div>
                  <div style={styles.analyticValue}>${totalRevenue30d.toFixed(2)}</div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Total Cost</div>
                  <div style={styles.analyticValue}>${totalCost30d.toFixed(2)}</div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Profit</div>
                  <div style={{...styles.analyticValue, color: profit30d >= 0 ? '#10b981' : '#ef4444'}}>
                    ${profit30d.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {lowStockItems.length > 0 && (
              <div style={styles.alertCard}>
                <h3 style={styles.alertTitle}>⚠️ Low Stock Alerts</h3>
                <div style={styles.list}>
                  {lowStockItems.map(item => (
                    <div key={item.id} style={styles.alertItem}>
                      <div>
                        <div style={styles.itemName}>{item.name}</div>
                        <div style={styles.itemMeta}>
                          Current: {item.quantity} {item.unit} | Threshold: {item.low_stock_threshold} {item.unit}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setShoppingFormData({
                            ...shoppingFormData,
                            item_name: item.name,
                            quantity: (item.low_stock_threshold || 0) * 2,
                            unit: item.unit,
                          });
                          setAddShoppingItemModalOpen(true);
                        }}
                        style={styles.addToListButton}
                      >
                        Add to Shopping List
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* INVENTORY VIEW */}
        {activeView === 'inventory' && (
          <>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Inventory Management</h2>
                <div style={styles.headerButtons}>
                  <button onClick={() => setInventoryTransactionModalOpen(true)} style={styles.secondaryButton}>
                    📝 Record Transaction
                  </button>
                  <button onClick={() => setAddInventoryModalOpen(true)} style={styles.primaryButton}>
                    + Add Item
                  </button>
                </div>
              </div>

              <div style={styles.inventoryStats}>
                <div style={styles.inventoryStat}>
                  <div style={styles.inventoryStatLabel}>Total Items</div>
                  <div style={styles.inventoryStatValue}>{inventoryItems.length}</div>
                </div>
                <div style={styles.inventoryStat}>
                  <div style={styles.inventoryStatLabel}>Total Value</div>
                  <div style={styles.inventoryStatValue}>${totalInventoryValue.toFixed(2)}</div>
                </div>
                <div style={styles.inventoryStat}>
                  <div style={styles.inventoryStatLabel}>Low Stock Items</div>
                  <div style={{...styles.inventoryStatValue, color: '#ef4444'}}>{lowStockItems.length}</div>
                </div>
              </div>

              {inventoryItems.length === 0 ? (
                <p style={styles.emptyText}>No inventory items yet. Add items to start tracking!</p>
              ) : (
                <div style={styles.inventoryGrid}>
                  {inventoryItems.map(item => {
                    const isLowStock = item.low_stock_threshold && item.quantity <= item.low_stock_threshold;
                    const itemValue = item.quantity * (item.cost_per_unit || 0);
                    
                    return (
                      <div key={item.id} style={{...styles.inventoryCard, borderColor: isLowStock ? '#ef4444' : '#e5e7eb'}}>
                        <div style={styles.inventoryCardHeader}>
                          <div style={styles.inventoryItemName}>{item.name}</div>
                          {item.category && <div style={styles.categoryBadge}>{item.category}</div>}
                        </div>
                        
                        <div style={styles.inventoryQuantity}>
                          <span style={{fontSize: '1.5rem', fontWeight: '600', color: isLowStock ? '#ef4444' : '#111827'}}>
                            {item.quantity}
                          </span>
                          <span style={{marginLeft: '0.5rem', color: '#6b7280'}}>{item.unit}</span>
                        </div>
                        
                        {item.low_stock_threshold && (
                          <div style={{...styles.inventoryMeta, color: isLowStock ? '#ef4444' : '#6b7280'}}>
                            {isLowStock ? '⚠️ Low Stock' : '✓ In Stock'} (Threshold: {item.low_stock_threshold} {item.unit})
                          </div>
                        )}
                        
                        <div style={styles.inventoryMeta}>
                          {item.cost_per_unit && <div>Cost: ${item.cost_per_unit}/{item.unit}</div>}
                          {itemValue > 0 && <div>Value: ${itemValue.toFixed(2)}</div>}
                          {item.supplier && <div>Supplier: {item.supplier}</div>}
                        </div>
                        
                        {item.notes && <div style={styles.inventoryNotes}>{item.notes}</div>}
                        
                        <div style={styles.inventoryActions}>
                          <button 
                            onClick={() => {
                              setTransactionFormData({...transactionFormData, item_id: item.id, type: 'use'});
                              setInventoryTransactionModalOpen(true);
                            }}
                            style={styles.inventoryActionButton}
                          >
                            Use
                          </button>
                          <button 
                            onClick={() => {
                              setTransactionFormData({...transactionFormData, item_id: item.id, type: 'add'});
                              setInventoryTransactionModalOpen(true);
                            }}
                            style={styles.inventoryActionButton}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shopping List */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>🛒 Shopping List</h2>
                <button onClick={() => setAddShoppingItemModalOpen(true)} style={styles.primaryButton}>
                  + Add Item
                </button>
              </div>

              {shoppingList.length === 0 ? (
                <p style={styles.emptyText}>Shopping list is empty.</p>
              ) : (
                <div style={styles.shoppingColumns}>
                  <div style={styles.shoppingColumn}>
                    <h3 style={styles.shoppingColumnTitle}>📋 Pending</h3>
                    {shoppingList.filter(i => i.status === 'pending').map(item => (
                      <div key={item.id} style={{...styles.shoppingCard, borderLeftColor: 
                        item.priority === 'urgent' ? '#ef4444' :
                        item.priority === 'high' ? '#f59e0b' : '#3b82f6'
                      }}>
                        <div style={styles.shoppingItemName}>{item.item_name}</div>
                        <div style={styles.shoppingItemMeta}>
                          {item.quantity} {item.unit}
                          {item.estimated_cost && ` • $${item.estimated_cost.toFixed(2)}`}
                        </div>
                        {item.supplier && <div style={styles.shoppingSupplier}>Supplier: {item.supplier}</div>}
                        <div style={styles.shoppingActions}>
                          <button onClick={() => updateShoppingItemStatus(item.id, 'ordered')} style={styles.shoppingActionButton}>
                            Mark Ordered
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.shoppingColumn}>
                    <h3 style={styles.shoppingColumnTitle}>📦 Ordered</h3>
                    {shoppingList.filter(i => i.status === 'ordered').map(item => (
                      <div key={item.id} style={styles.shoppingCard}>
                        <div style={styles.shoppingItemName}>{item.item_name}</div>
                        <div style={styles.shoppingItemMeta}>{item.quantity} {item.unit}</div>
                        <button onClick={() => updateShoppingItemStatus(item.id, 'received')} style={styles.shoppingActionButton}>
                          Mark Received
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={styles.shoppingColumn}>
                    <h3 style={styles.shoppingColumnTitle}>✅ Received</h3>
                    {shoppingList.filter(i => i.status === 'received').slice(0, 5).map(item => (
                      <div key={item.id} style={{...styles.shoppingCard, opacity: 0.7}}>
                        <div style={styles.shoppingItemName}>{item.item_name}</div>
                        <div style={styles.shoppingItemMeta}>{item.quantity} {item.unit}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Recent Transactions</h2>
              {inventoryTransactions.length === 0 ? (
                <p style={styles.emptyText}>No transactions yet.</p>
              ) : (
                <div style={styles.transactionsList}>
                  {inventoryTransactions.slice(0, 10).map(trans => {
                    const item = inventoryItems.find(i => i.id === trans.item_id);
                    return (
                      <div key={trans.id} style={styles.transactionItem}>
                        <div style={styles.transactionIcon}>
                          {trans.type === 'add' ? '➕' : trans.type === 'use' ? '➖' : trans.type === 'waste' ? '🗑️' : '🔄'}
                        </div>
                        <div style={styles.transactionContent}>
                          <div style={styles.transactionName}>
                            {trans.type.toUpperCase()}: {item?.name || 'Unknown Item'}
                          </div>
                          <div style={styles.transactionMeta}>
                            {trans.quantity} {item?.unit} • {trans.created_by} • {new Date(trans.created_at).toLocaleString()}
                          </div>
                          {trans.notes && <div style={styles.transactionNotes}>{trans.notes}</div>}
                        </div>
                        {trans.cost && (
                          <div style={styles.transactionCost}>${trans.cost.toFixed(2)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* CALENDAR VIEW */}
        {activeView === 'calendar' && (
          <>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Production Calendar</h2>
                <button onClick={() => setScheduleModalOpen(true)} style={styles.primaryButton}>
                  + Schedule Batch
                </button>
              </div>

              <div style={styles.calendarControls}>
                <button 
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                  style={styles.calendarNavButton}
                >
                  ◀ Previous
                </button>
                <h3 style={styles.calendarMonth}>
                  {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </h3>
                <button 
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                  style={styles.calendarNavButton}
                >
                  Next ▶
                </button>
              </div>

              <div style={styles.calendarGrid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} style={styles.calendarDayHeader}>{day}</div>
                ))}
                
                {calendarDays.map((date, index) => {
                  if (!date) return <div key={`empty-${index}`} style={styles.calendarDayEmpty}></div>;
                  
                  const batchesOnDay = getBatchesForDate(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div 
                      key={date.toISOString()} 
                      style={{
                        ...styles.calendarDay,
                        backgroundColor: isToday ? '#e0f2fe' : '#ffffff',
                        borderColor: isToday ? '#0284c7' : '#e5e7eb',
                      }}
                    >
                      <div style={styles.calendarDayNumber}>{date.getDate()}</div>
                      {batchesOnDay.length > 0 && (
                        <div style={styles.calendarBadge}>{batchesOnDay.length}</div>
                      )}
                      <div style={styles.calendarBatches}>
                        {batchesOnDay.slice(0, 2).map(batch => (
                          <div 
                            key={batch.id} 
                            style={{
                              ...styles.calendarBatchItem,
                              backgroundColor: 
                                batch.status === 'completed' ? '#d1fae5' :
                                batch.status === 'in_progress' ? '#fef3c7' :
                                batch.status === 'cancelled' ? '#fee2e2' : '#dbeafe'
                            }}
                            title={`${batch.name}${batch.scheduled_time ? ` at ${batch.scheduled_time}` : ''}`}
                          >
                            {batch.name.substring(0, 15)}
                            {batch.name.length > 15 ? '...' : ''}
                          </div>
                        ))}
                        {batchesOnDay.length > 2 && (
                          <div style={styles.calendarMoreBadge}>+{batchesOnDay.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Scheduled Batches */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Upcoming Scheduled Batches</h2>
              {scheduledBatches.filter(b => b.status === 'scheduled').length === 0 ? (
                <p style={styles.emptyText}>No upcoming batches scheduled.</p>
              ) : (
                <div style={styles.list}>
                  {scheduledBatches
                    .filter(b => b.status === 'scheduled')
                    .slice(0, 10)
                    .map(batch => (
                      <div key={batch.id} style={styles.scheduledBatchItem}>
                        <div style={styles.scheduledBatchMain}>
                          <div style={styles.itemName}>{batch.name}</div>
                          <div style={styles.itemMeta}>
                            📅 {new Date(batch.scheduled_date).toLocaleDateString()}
                            {batch.scheduled_time && ` at ${batch.scheduled_time}`}
                            {batch.assigned_to_name && ` • 👤 ${batch.assigned_to_name}`}
                            • {batch.batch_size_multiplier}x
                          </div>
                          {batch.notes && <div style={styles.batchNotes}>{batch.notes}</div>}
                        </div>
                        <button 
                          onClick={async () => {
                            const { error } = await supabase
                              .from('scheduled_batches')
                              .update({ status: 'in_progress' })
                              .eq('id', batch.id);
                            if (!error) await fetchScheduledBatches(user.id);
                          }}
                          style={styles.startButton}
                        >
                          Start
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ANALYTICS VIEW */}
        {activeView === 'analytics' && (
          <>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>📊 Advanced Analytics</h2>
              
              <h3 style={styles.sectionTitle}>Top 5 Workflows by Completion</h3>
              <div style={styles.analyticsTable}>
                <div style={styles.tableHeader}>
                  <div style={styles.tableCell}>Workflow</div>
                  <div style={styles.tableCell}>Completions</div>
                  <div style={styles.tableCell}>Avg Duration</div>
                  <div style={styles.tableCell}>Avg Cost</div>
                </div>
                {topWorkflows.map(wf => (
                  <div key={wf.name} style={styles.tableRow}>
                    <div style={styles.tableCell}>{wf.name}</div>
                    <div style={styles.tableCell}>{wf.count}</div>
                    <div style={styles.tableCell}>{Math.round(wf.avgDuration)} min</div>
                    <div style={styles.tableCell}>${wf.avgCost.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>💰 Revenue & Profitability</h2>
              <div style={styles.analyticsGrid}>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>All-Time Revenue</div>
                  <div style={styles.analyticValue}>
                    ${batchTemplates.reduce((sum, t) => sum + ((t.selling_price || 0) * t.times_used), 0).toFixed(2)}
                  </div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>All-Time Costs</div>
                  <div style={styles.analyticValue}>
                    ${batchReports.reduce((sum, r) => sum + (r.total_cost || 0), 0).toFixed(2)}
                  </div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>30-Day Profit</div>
                  <div style={{...styles.analyticValue, color: profit30d >= 0 ? '#10b981' : '#ef4444'}}>
                    ${profit30d.toFixed(2)}
                  </div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>30-Day Margin</div>
                  <div style={{...styles.analyticValue, color: profitMargin30d >= 20 ? '#10b981' : '#f59e0b'}}>
                    {profitMargin30d.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>📦 Inventory Insights</h2>
              <div style={styles.analyticsGrid}>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Total Items</div>
                  <div style={styles.analyticValue}>{inventoryItems.length}</div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Inventory Value</div>
                  <div style={styles.analyticValue}>${totalInventoryValue.toFixed(2)}</div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Low Stock Alerts</div>
                  <div style={{...styles.analyticValue, color: '#ef4444'}}>{lowStockItems.length}</div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Transactions (30d)</div>
                  <div style={styles.analyticValue}>
                    {inventoryTransactions.filter(t => {
                      const transDate = new Date(t.created_at);
                      return transDate >= last30Days;
                    }).length}
                  </div>
                </div>
              </div>

              <h3 style={{...styles.sectionTitle, marginTop: '2rem'}}>Inventory by Category</h3>
              <div style={styles.categoryBreakdown}>
                {Object.entries(
                  inventoryItems.reduce((acc, item) => {
                    const cat = item.category || 'Uncategorized';
                    if (!acc[cat]) acc[cat] = { count: 0, value: 0 };
                    acc[cat].count++;
                    acc[cat].value += item.quantity * (item.cost_per_unit || 0);
                    return acc;
                  }, {} as Record<string, { count: number; value: number }>)
                ).map(([category, data]) => (
                  <div key={category} style={styles.categoryItem}>
                    <div style={styles.categoryName}>{category}</div>
                    <div style={styles.categoryStats}>
                      <span>{data.count} items</span>
                      <span>${data.value.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>📅 Production Trends</h2>
              <div style={styles.analyticsGrid}>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Batches This Week</div>
                  <div style={styles.analyticValue}>
                    {batchReports.filter(r => {
                      const reportDate = new Date(r.timestamp);
                      const weekStart = new Date();
                      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                      return reportDate >= weekStart;
                    }).length}
                  </div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Batches This Month</div>
                  <div style={styles.analyticValue}>
                    {batchReports.filter(r => {
                      const reportDate = new Date(r.timestamp);
                      const now = new Date();
                      return reportDate.getMonth() === now.getMonth() && 
                             reportDate.getFullYear() === now.getFullYear();
                    }).length}
                  </div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Avg Batch Duration</div>
                  <div style={styles.analyticValue}>
                    {Math.round(batchReports.filter(r => r.actual_duration).reduce((sum, r) => 
                      sum + (r.actual_duration || 0), 0) / 
                      (batchReports.filter(r => r.actual_duration).length || 1) / 60)} min
                  </div>
                </div>
                <div style={styles.analyticItem}>
                  <div style={styles.analyticLabel}>Scheduled Ahead</div>
                  <div style={styles.analyticValue}>
                    {scheduledBatches.filter(b => b.status === 'scheduled').length}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Inventory Item Modal */}
      {addInventoryModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setAddInventoryModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Add Inventory Item</h3>
            
            <input
              type="text"
              placeholder="Item name *"
              value={inventoryFormData.name}
              onChange={(e) => setInventoryFormData({...inventoryFormData, name: e.target.value})}
              style={styles.input}
            />

            <div style={styles.inputRow}>
              <input
                type="number"
                placeholder="Quantity *"
                value={inventoryFormData.quantity || ''}
                onChange={(e) => setInventoryFormData({...inventoryFormData, quantity: parseFloat(e.target.value) || 0})}
                style={{...styles.input, flex: 2}}
              />
              <input
                type="text"
                placeholder="Unit *"
                value={inventoryFormData.unit}
                onChange={(e) => setInventoryFormData({...inventoryFormData, unit: e.target.value})}
                style={{...styles.input, flex: 1}}
              />
            </div>

            <div style={styles.inputRow}>
              <input
                type="number"
                placeholder="Low stock threshold"
                value={inventoryFormData.low_stock_threshold || ''}
                onChange={(e) => setInventoryFormData({...inventoryFormData, low_stock_threshold: parseFloat(e.target.value) || 0})}
                style={styles.input}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cost per unit"
                value={inventoryFormData.cost_per_unit || ''}
                onChange={(e) => setInventoryFormData({...inventoryFormData, cost_per_unit: parseFloat(e.target.value) || 0})}
                style={styles.input}
              />
            </div>

            <input
              type="text"
              placeholder="Supplier"
              value={inventoryFormData.supplier}
              onChange={(e) => setInventoryFormData({...inventoryFormData, supplier: e.target.value})}
              style={styles.input}
            />

            <input
              type="text"
              placeholder="Category"
              value={inventoryFormData.category}
              onChange={(e) => setInventoryFormData({...inventoryFormData, category: e.target.value})}
              style={styles.input}
            />

            <textarea
              placeholder="Notes"
              value={inventoryFormData.notes}
              onChange={(e) => setInventoryFormData({...inventoryFormData, notes: e.target.value})}
              style={{...styles.input, minHeight: '80px'}}
            />

            <div style={styles.modalButtons}>
              <button onClick={handleAddInventoryItem} style={styles.primaryButton}>
                Add Item
              </button>
              <button onClick={() => setAddInventoryModalOpen(false)} style={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Transaction Modal */}
      {inventoryTransactionModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setInventoryTransactionModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Record Inventory Transaction</h3>
            
            <select
              value={transactionFormData.item_id}
              onChange={(e) => setTransactionFormData({...transactionFormData, item_id: e.target.value})}
              style={styles.input}
            >
              <option value="">Select item *</option>
              {inventoryItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.quantity} {item.unit})
                </option>
              ))}
            </select>

            <select
              value={transactionFormData.type}
              onChange={(e) => setTransactionFormData({...transactionFormData, type: e.target.value as any})}
              style={styles.input}
            >
              <option value="use">Use (subtract)</option>
              <option value="add">Add (increase)</option>
              <option value="adjust">Adjust (set to)</option>
              <option value="waste">Waste (subtract)</option>
            </select>

            <input
              type="number"
              step="0.01"
              placeholder="Quantity *"
              value={transactionFormData.quantity || ''}
              onChange={(e) => setTransactionFormData({...transactionFormData, quantity: parseFloat(e.target.value) || 0})}
              style={styles.input}
            />

            <input
              type="number"
              step="0.01"
              placeholder="Cost (optional)"
              value={transactionFormData.cost || ''}
              onChange={(e) => setTransactionFormData({...transactionFormData, cost: parseFloat(e.target.value) || 0})}
              style={styles.input}
            />

            <textarea
              placeholder="Notes"
              value={transactionFormData.notes}
              onChange={(e) => setTransactionFormData({...transactionFormData, notes: e.target.value})}
              style={{...styles.input, minHeight: '80px'}}
            />

            <div style={styles.modalButtons}>
              <button onClick={handleInventoryTransaction} style={styles.primaryButton}>
                Record Transaction
              </button>
              <button onClick={() => setInventoryTransactionModalOpen(false)} style={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Shopping List Item Modal */}
      {addShoppingItemModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setAddShoppingItemModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Add to Shopping List</h3>
            
            <input
              type="text"
              placeholder="Item name *"
              value={shoppingFormData.item_name}
              onChange={(e) => setShoppingFormData({...shoppingFormData, item_name: e.target.value})}
              style={styles.input}
            />

            <div style={styles.inputRow}>
              <input
                type="number"
                placeholder="Quantity *"
                value={shoppingFormData.quantity || ''}
                onChange={(e) => setShoppingFormData({...shoppingFormData, quantity: parseFloat(e.target.value) || 0})}
                style={{...styles.input, flex: 2}}
              />
              <input
                type="text"
                placeholder="Unit *"
                value={shoppingFormData.unit}
                onChange={(e) => setShoppingFormData({...shoppingFormData, unit: e.target.value})}
                style={{...styles.input, flex: 1}}
              />
            </div>

            <select
              value={shoppingFormData.priority}
              onChange={(e) => setShoppingFormData({...shoppingFormData, priority: e.target.value as any})}
              style={styles.input}
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>

            <input
              type="number"
              step="0.01"
              placeholder="Estimated cost"
              value={shoppingFormData.estimated_cost || ''}
              onChange={(e) => setShoppingFormData({...shoppingFormData, estimated_cost: parseFloat(e.target.value) || 0})}
              style={styles.input}
            />

            <input
              type="text"
              placeholder="Supplier"
              value={shoppingFormData.supplier}
              onChange={(e) => setShoppingFormData({...shoppingFormData, supplier: e.target.value})}
              style={styles.input}
            />

            <textarea
              placeholder="Notes"
              value={shoppingFormData.notes}
              onChange={(e) => setShoppingFormData({...shoppingFormData, notes: e.target.value})}
              style={{...styles.input, minHeight: '60px'}}
            />

            <div style={styles.modalButtons}>
              <button onClick={handleAddShoppingItem} style={styles.primaryButton}>
                Add to List
              </button>
              <button onClick={() => setAddShoppingItemModalOpen(false)} style={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Batch Modal */}
      {scheduleModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setScheduleModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Schedule Batch</h3>
            
            <input
              type="text"
              placeholder="Batch name *"
              value={scheduleFormData.name}
              onChange={(e) => setScheduleFormData({...scheduleFormData, name: e.target.value})}
              style={styles.input}
            />

            <select
              value={scheduleFormData.workflow_id}
              onChange={(e) => setScheduleFormData({...scheduleFormData, workflow_id: e.target.value})}
              style={styles.input}
            >
              <option value="">Select workflow *</option>
              {workflows.map(wf => (
                <option key={wf.id} value={wf.id}>{wf.name}</option>
              ))}
            </select>

            {batchTemplates.length > 0 && (
              <select
                value={scheduleFormData.template_id}
                onChange={(e) => {
                  const template = batchTemplates.find(t => t.id === e.target.value);
                  setScheduleFormData({
                    ...scheduleFormData,
                    template_id: e.target.value,
                    workflow_id: template?.workflow_id || scheduleFormData.workflow_id,
                    name: template?.name || scheduleFormData.name,
                    batch_size_multiplier: template?.batch_size_multiplier || 1,
                  });
                }}
                style={styles.input}
              >
                <option value="">Or select template (optional)</option>
                {batchTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}

            <div style={styles.inputRow}>
              <input
                type="date"
                value={scheduleFormData.scheduled_date}
                onChange={(e) => setScheduleFormData({...scheduleFormData, scheduled_date: e.target.value})}
                style={{...styles.input, flex: 2}}
              />
              <input
                type="time"
                value={scheduleFormData.scheduled_time}
                onChange={(e) => setScheduleFormData({...scheduleFormData, scheduled_time: e.target.value})}
                style={{...styles.input, flex: 1}}
              />
            </div>

            <input
              type="number"
              step="0.1"
              placeholder="Batch size multiplier"
              value={scheduleFormData.batch_size_multiplier || ''}
              onChange={(e) => setScheduleFormData({...scheduleFormData, batch_size_multiplier: parseFloat(e.target.value) || 1})}
              style={styles.input}
            />

            {isPremium && networkMembers.length > 0 && (
              <select
                value={scheduleFormData.assigned_to}
                onChange={(e) => setScheduleFormData({...scheduleFormData, assigned_to: e.target.value})}
                style={styles.input}
              >
                <option value="">Assign to (optional)</option>
                {networkMembers.map(member => (
                  <option key={member.id} value={member.user_id}>
                    {member.profiles?.device_name || member.profiles?.email}
                  </option>
                ))}
              </select>
            )}

            <textarea
              placeholder="Notes"
              value={scheduleFormData.notes}
              onChange={(e) => setScheduleFormData({...scheduleFormData, notes: e.target.value})}
              style={{...styles.input, minHeight: '60px'}}
            />

            <div style={styles.modalButtons}>
              <button onClick={handleScheduleBatch} style={styles.primaryButton}>
                Schedule Batch
              </button>
              <button onClick={() => setScheduleModalOpen(false)} style={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '1rem 0' },
  headerContent: { maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '1.5rem', fontWeight: '600', margin: 0, color: '#111827' },
  premiumBadge: { fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' },
  headerButtons: { display: 'flex', gap: '0.75rem' },
  linkButton: { padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', textDecoration: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', display: 'flex', alignItems: 'center' },
  signOutButton: { padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' },
  tabBar: { maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e5e7eb' },
  tab: { padding: '1rem 1.5rem', backgroundColor: 'transparent', border: 'none', borderBottom: '2px solid transparent', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', cursor: 'pointer', marginBottom: '-2px' },
  tabActive: { color: '#3b82f6', borderBottomColor: '#3b82f6' },
  content: { maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: '1.125rem', color: '#6b7280' },
  card: { backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' as const, gap: '1rem' },
  cardTitle: { fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#111827' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  statCard: { backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', textAlign: 'center' as const, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
  statNumber: { fontSize: '2rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' },
  statLabel: { fontSize: '0.875rem', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  analyticsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' },
  analyticItem: { padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' },
  analyticLabel: { fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' as const },
  analyticValue: { fontSize: '1.25rem', fontWeight: '600', color: '#111827' },
  alertCard: { backgroundColor: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  alertTitle: { fontSize: '1.125rem', fontWeight: '600', color: '#dc2626', marginBottom: '1rem' },
  list: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  alertItem: { padding: '1rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: '1rem', fontWeight: '500', color: '#111827', marginBottom: '0.25rem' },
  itemMeta: { fontSize: '0.875rem', color: '#6b7280' },
  addToListButton: { padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  inventoryStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
  inventoryStat: { padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', textAlign: 'center' as const },
  inventoryStatLabel: { fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' as const },
  inventoryStatValue: { fontSize: '1.5rem', fontWeight: '700', color: '#111827' },
  inventoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  inventoryCard: { padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '2px solid #e5e7eb' },
  inventoryCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  inventoryItemName: { fontSize: '1rem', fontWeight: '600', color: '#111827' },
  categoryBadge: { fontSize: '0.75rem', backgroundColor: '#e5e7eb', color: '#374151', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' },
  inventoryQuantity: { marginBottom: '0.5rem' },
  inventoryMeta: { fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' },
  inventoryNotes: { fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' as const, marginTop: '0.5rem', marginBottom: '0.5rem' },
  inventoryActions: { display: 'flex', gap: '0.5rem', marginTop: '1rem' },
  inventoryActionButton: { flex: 1, padding: '0.5rem', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' },
  shoppingColumns: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' },
  shoppingColumn: { backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' },
  shoppingColumnTitle: { fontSize: '0.875rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' },
  shoppingCard: { backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', borderLeft: '4px solid', marginBottom: '0.75rem' },
  shoppingItemName: { fontSize: '0.875rem', fontWeight: '500', color: '#111827', marginBottom: '0.25rem' },
  shoppingItemMeta: { fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' },
  shoppingSupplier: { fontSize: '0.75rem', color: '#3b82f6', marginBottom: '0.5rem' },
  shoppingActions: { marginTop: '0.5rem' },
  shoppingActionButton: { width: '100%', padding: '0.25rem 0.75rem', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.75rem', cursor: 'pointer' },
  transactionsList: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  transactionItem: { display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' },
  transactionIcon: { fontSize: '1.5rem', width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '50%' },
  transactionContent: { flex: 1 },
  transactionName: { fontSize: '0.875rem', fontWeight: '500', color: '#111827', marginBottom: '0.25rem' },
  transactionMeta: { fontSize: '0.75rem', color: '#6b7280' },
  transactionNotes: { fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' as const, marginTop: '0.25rem' },
  transactionCost: { fontSize: '1rem', fontWeight: '600', color: '#111827' },
  calendarControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  calendarNavButton: { padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' },
  calendarMonth: { fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0 },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' },
  calendarDayHeader: { padding: '0.5rem', textAlign: 'center' as const, fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' as const },
  calendarDayEmpty: { aspectRatio: '1', backgroundColor: '#f9fafb' },
  calendarDay: { aspectRatio: '1', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.5rem', position: 'relative' as const, overflow: 'hidden' },
  calendarDayNumber: { fontSize: '0.875rem', fontWeight: '500', color: '#111827', marginBottom: '0.25rem' },
  calendarBadge: { position: 'absolute' as const, top: '0.25rem', right: '0.25rem', backgroundColor: '#3b82f6', color: '#ffffff', borderRadius: '50%', width: '1.25rem', height: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: '600' },
  calendarBatches: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  calendarBatchItem: { fontSize: '0.625rem', padding: '0.125rem 0.25rem', borderRadius: '0.25rem', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  calendarMoreBadge: { fontSize: '0.625rem', color: '#6b7280', fontStyle: 'italic' as const },
  scheduledBatchItem: { padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  scheduledBatchMain: { flex: 1 },
  batchNotes: { fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' as const, marginTop: '0.25rem' },
  startButton: { padding: '0.5rem 1rem', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' },
  sectionTitle: { fontSize: '1rem', fontWeight: '600', color: '#111827', marginTop: '1.5rem', marginBottom: '1rem' },
  analyticsTable: { border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', backgroundColor: '#f9fafb', padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #e5e7eb' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #e5e7eb' },
  tableCell: { padding: '0.25rem 0.5rem' },
  categoryBreakdown: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  categoryItem: { padding: '0.75rem 1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { fontSize: '0.875rem', fontWeight: '500', color: '#111827' },
  categoryStats: { display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' },
  primaryButton: { padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' },
  secondaryButton: { padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' },
  modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' },
  modal: { backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '2rem', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' as const },
  modalTitle: { fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#111827' },
  input: { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', marginBottom: '1rem' },
  inputRow: { display: 'flex', gap: '0.5rem' },
  modalButtons: { display: 'flex', gap: '0.5rem', marginTop: '1rem' },
  cancelButton: { flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' },
  emptyText: { color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' as const, textAlign: 'center' as const, padding: '2rem' },
};