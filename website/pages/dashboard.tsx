'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import Overview from '../components/DashboardOverview';
import Workflows from '../components/DashboardWorkflows';
import Inventory from '../components/DashboardInventory';
import Calendar from '../components/DashboardCalendar';
import Schedule from '../components/DashboardSchedule';
import Analytics from '../components/DashboardAnalytics';
import type { 
  Profile, 
  Workflow, 
  Batch, 
  BatchCompletionReport, 
  BatchTemplate,
  NetworkMember,
  InventoryItem,
  InventoryTransaction,
  ShoppingListItem,
  ScheduledBatch
} from '../lib/dashboard-types';

export default function EnhancedDashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchReports, setBatchReports] = useState<BatchCompletionReport[]>([]);
  const [batchTemplates, setBatchTemplates] = useState<BatchTemplate[]>([]);
  const [networkMembers, setNetworkMembers] = useState<NetworkMember[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [scheduledBatches, setScheduledBatches] = useState<ScheduledBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'workflows' | 'inventory' | 'calendar' | 'schedule' | 'analytics'>('overview');
  const [menuOpen, setMenuOpen] = useState(false);

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

    const workflowChannel = supabase
      .channel('workflow-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workflows', 
        filter: `user_id=eq.${user.id}` 
      }, () => fetchWorkflows(user.id))
      .subscribe();

    const batchChannel = supabase
      .channel('batch-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'batches', 
        filter: `user_id=eq.${user.id}` 
      }, () => fetchBatches(user.id))
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(scheduledChannel);
      supabase.removeChannel(workflowChannel);  
      supabase.removeChannel(batchChannel);  
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
      await fetchProfile(userId);
      
      // Check if user is premium after profile is loaded
      const profileData = await new Promise<any>((resolve) => {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
          .then(({ data }) => resolve(data));
      });

      const premium = profileData?.role === 'premium' || profileData?.role === 'admin';
      
      if (!premium) {
        // Redirect free users to account page
        window.location.href = '/account';
        return;
      }

      // Only fetch dashboard data for premium users
      await Promise.all([
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

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading Enhanced Dashboard...</div>
      </div>
    );
  }

  const isPremium = profile?.role === 'premium' || profile?.role === 'admin';

  const sharedProps = {
    user,
    profile,
    workflows,
    batches,
    batchReports,
    batchTemplates,
    networkMembers,
    inventoryItems,
    inventoryTransactions,
    shoppingList,
    scheduledBatches,
    isPremium,
    fetchInventoryItems: () => fetchInventoryItems(user.id),
    fetchInventoryTransactions: () => fetchInventoryTransactions(user.id),
    fetchShoppingList: () => fetchShoppingList(user.id),
    fetchScheduledBatches: () => fetchScheduledBatches(user.id),
    fetchWorkflows: () => fetchWorkflows(user.id),
    fetchBatches: () => fetchBatches(user.id),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Enhanced Dashboard</h1>
            {isPremium && <p className="text-sm text-gray-500 mt-1">Premium Account</p>}
          </div>
          <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <Link 
                  href="/account" 
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Account
                </Link>
                <Link 
                  href="/settings" 
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <button 
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-6 border-b-2 border-gray-200">
        <div className="flex gap-2">
          <button 
            className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              activeView === 'overview' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveView('overview')}
          >
            Overview
          </button>
          <button 
            className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              activeView === 'workflows' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveView('workflows')}
          >
            Workflows
          </button>
          <button 
            className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              activeView === 'inventory' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveView('inventory')}
          >
            Inventory
          </button>
          <button 
            className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              activeView === 'calendar' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveView('calendar')}
          >
            Calendar
          </button>
          {isPremium && (
            <button 
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
                activeView === 'schedule' 
                  ? 'text-blue-600 border-blue-600' 
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
              onClick={() => setActiveView('schedule')}
            >
              Schedule
            </button>
          )}
          <button 
            className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              activeView === 'analytics' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveView('analytics')}
          >
            Analytics
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeView === 'overview' && <Overview {...sharedProps} />}
        {activeView === 'workflows' && <Workflows {...sharedProps} />}
        {activeView === 'inventory' && <Inventory {...sharedProps} />}
        {activeView === 'calendar' && <Calendar {...sharedProps} />}
        {activeView === 'schedule' && <Schedule {...sharedProps} />}
        {activeView === 'analytics' && <Analytics {...sharedProps} />}
      </div>
    </div>
  );
}