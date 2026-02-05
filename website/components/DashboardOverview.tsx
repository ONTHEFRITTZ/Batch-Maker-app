import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DashboardProps } from '../lib/dashboard-types';
import { supabase } from '../lib/supabase';

export default function Overview({
  workflows,
  batches,
  inventoryItems,
  scheduledBatches,
  batchReports,
  batchTemplates,
  shoppingList,
  networkMembers,
  user,
  profile,
  isPremium,
  fetchShoppingList,
}: DashboardProps) {
  const [addShoppingItemModalOpen, setAddShoppingItemModalOpen] = useState(false);
  const [shoppingFormData, setShoppingFormData] = useState({
    item_name: '',
    quantity: 0,
    unit: 'kg',
    priority: 'normal' as 'urgent' | 'high' | 'normal' | 'low',
    estimated_cost: 0,
    supplier: '',
    notes: '',
  });
  const [upcomingShifts, setUpcomingShifts] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (isPremium && user) {
      fetchUpcomingShifts();
    }
    loadRecentActivity();
  }, [user, isPremium, batchReports]);

  async function fetchUpcomingShifts() {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('owner_id', user.id)
      .eq('status', 'scheduled')
      .gte('shift_date', today)
      .lte('shift_date', nextWeek)
      .order('shift_date')
      .limit(5);

    setUpcomingShifts(shifts || []);
  }

  function loadRecentActivity() {
    const activities = batchReports
      .slice(0, 5)
      .map(report => ({
        type: 'completion',
        title: `Completed: ${report.workflow_name || 'Batch'}`,
        subtitle: `${report.batch_size_multiplier}x batch size`,
        time: new Date(report.timestamp),
        icon: '✅',
      }));

    setRecentActivity(activities);
  }

  const lowStockItems = inventoryItems.filter(item => 
    item.low_stock_threshold && item.quantity <= item.low_stock_threshold
  );

  const activeBatches = batches.filter(b => !b.completed_at);
  const completedToday = batchReports.filter(r => {
    const reportDate = new Date(r.timestamp).toDateString();
    const today = new Date().toDateString();
    return reportDate === today;
  });

  const scheduledToday = scheduledBatches.filter(sb => {
    const schedDate = new Date(sb.scheduled_date).toDateString();
    const today = new Date().toDateString();
    return schedDate === today && !sb.completed_at;
  });

  const urgentShoppingItems = shoppingList.filter(item => item.priority === 'urgent' || item.priority === 'high');

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const recentReports = batchReports.filter(r => new Date(r.timestamp) >= last30Days);
  
  const totalRevenue30d = recentReports.reduce((sum, r) => {
    const template = batchTemplates.find(t => t.workflow_name === r.workflow_name);
    return sum + ((template?.selling_price || 0) * r.batch_size_multiplier);
  }, 0);
  
  const totalCost30d = recentReports.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const profit30d = totalRevenue30d - totalCost30d;

  const teamMembersOnline = isPremium ? networkMembers.filter(m => {
    if (!m.last_active) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(m.last_active) > fiveMinutesAgo;
  }) : [];

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

      await fetchShoppingList();
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

  return (
    <>
      {/* Welcome Header */}
      <div className="glass-card rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, {profile?.device_name || user?.email?.split('@')[0] || 'User'}!
        </h2>
        <p className="text-gray-600">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/dashboard?view=workflows" className="glass-card rounded-xl p-6 shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Batches</h3>
            <span className="text-2xl"></span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{activeBatches.length}</div>
          <div className="text-xs text-blue-600">View workflows →</div>
        </Link>

        <Link href="/dashboard?view=analytics"  className="glass-card rounded-xl p-6 shadow-sm border-l-4 border-green-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Completed Today</h3>
            <span className="text-2xl"></span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{completedToday.length}</div>
          <div className="text-xs text-green-600">View analytics →</div>
        </Link>

        <Link href="/dashboard?view=calendar" className="glass-card rounded-xl p-6 shadow-sm border-l-4 border-purple-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Scheduled Today</h3>
            <span className="text-2xl"></span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{scheduledToday.length}</div>
          <div className="text-xs text-purple-600">View calendar →</div>
        </Link>

        {isPremium ? (
          <Link href="/dashboard?view=schedule" className="glass-card rounded-xl p-6 shadow-sm border-l-4 border-orange-500 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Team Online</h3>
              <span className="text-2xl"></span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {teamMembersOnline.length}/{networkMembers.length}
            </div>
            <div className="text-xs text-orange-600">Manage team →</div>
          </Link>
        ) : (
          <Link href="/upgrade" className="glass-card rounded-xl p-6 shadow-sm border-l-4 border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Upgrade</h3>
              <span className="text-2xl"></span>
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-1">Go Premium</div>
            <div className="text-xs text-yellow-700">Unlock team features →</div>
          </Link>
        )}
      </div>

      {/* Alerts Section */}
      {(lowStockItems.length > 0 || urgentShoppingItems.length > 0 || activeBatches.some(b => b.active_timers?.length > 0)) && (
        <div className="glass-card rounded-xl p-6 shadow-sm border-l-4 border-red-500 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-xl"></span>
            Alerts & Notifications
          </h3>
          <div className="space-y-2">
            {lowStockItems.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-600">
                    Current: {item.quantity} {item.unit} | Threshold: {item.low_stock_threshold} {item.unit}
                  </p>
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
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 whitespace-nowrap"
                >
                  Reorder
                </button>
              </div>
            ))}

            {urgentShoppingItems.slice(0, 2).map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                  <p className="text-xs text-gray-600">
                    {item.priority.toUpperCase()} - {item.quantity} {item.unit}
                  </p>
                </div>
                <Link 
                  href="/dashboard?view=inventory"
                  className="text-xs font-semibold text-orange-600 hover:underline"
                >
                  View List →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Quick Actions - Spans 2 columns */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link
              href="/workflows/create"
              className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2"></span>
              <span className="text-sm font-medium text-gray-700 text-center">New Workflow</span>
            </Link>
            
            <Link
              href="/dashboard?view=calendar"
              className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2"></span>
              <span className="text-sm font-medium text-gray-700 text-center">Schedule Batch</span>
            </Link>

            <Link
              href="/dashboard?view=inventory"
              className="flex flex-col items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2"></span>
              <span className="text-sm font-medium text-gray-700 text-center">Check Inventory</span>
            </Link>

            {isPremium && (
              <>
                <Link
                  href="/dashboard?view=schedule"
                  className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <span className="text-3xl mb-2"></span>
                  <span className="text-sm font-medium text-gray-700 text-center">Manage Team</span>
                </Link>

                <Link
                  href="/settings"
                  className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-3xl mb-2"></span>
                  <span className="text-sm font-medium text-gray-700 text-center">Team Settings</span>
                </Link>
              </>
            )}

            <Link
              href="/dashboard?view=analytics"
              className="flex flex-col items-center justify-center p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2"></span>
              <span className="text-sm font-medium text-gray-700 text-center">View Analytics</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity - Spans 1 column */}
        <div className="glass-card rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{activity.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.subtitle}</p>
                    <p className="text-xs text-gray-400">{activity.time.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 30-Day Performance */}
      <div className="glass-card rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">30-Day Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Batches Completed</div>
            <div className="text-2xl font-bold text-gray-900">{recentReports.length}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Total Revenue</div>
            <div className="text-2xl font-bold text-green-600">${totalRevenue30d.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Total Cost</div>
            <div className="text-2xl font-bold text-gray-900">${totalCost30d.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Net Profit</div>
            <div className={`text-2xl font-bold ${profit30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${profit30d.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Shifts (Premium Only) */}
      {isPremium && upcomingShifts.length > 0 && (
        <div className="glass-card rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Shifts (Next 7 Days)</h3>
            <Link href="/dashboard?view=schedule" className="text-sm text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingShifts.map(shift => (
              <div key={shift.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{shift.assigned_to_name}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(shift.shift_date).toLocaleDateString()} • {shift.start_time} - {shift.end_time}
                  </p>
                </div>
                {shift.role && (
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                    {shift.role}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900 mb-1">{workflows.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Total Workflows</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900 mb-1">{inventoryItems.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Inventory Items</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center shadow-sm">
          <div className={`text-2xl font-bold mb-1 ${lowStockItems.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {lowStockItems.length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Low Stock Alerts</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {scheduledBatches.filter(b => b.status === 'scheduled').length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Scheduled Batches</div>
        </div>
      </div>

      {/* Add Shopping Item Modal - FIXED Z-INDEX */}
      {addShoppingItemModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" 
          style={{ zIndex: 9999 }}
          onClick={() => setAddShoppingItemModalOpen(false)}
        >
          <div 
            className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" 
            style={{ zIndex: 10000, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Add Shopping Item</h3>

            <input
              type="text"
              placeholder="Item name"
              value={shoppingFormData.item_name}
              onChange={(e) => setShoppingFormData({...shoppingFormData, item_name: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="Quantity"
                value={shoppingFormData.quantity || ''}
                onChange={(e) => setShoppingFormData({...shoppingFormData, quantity: parseFloat(e.target.value) || 0})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
              <select
                value={shoppingFormData.unit}
                onChange={(e) => setShoppingFormData({...shoppingFormData, unit: e.target.value})}
                className="p-3 border border-gray-300 rounded-lg"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="mL">mL</option>
                <option value="units">units</option>
              </select>
            </div>

            <select
              value={shoppingFormData.priority}
              onChange={(e) => setShoppingFormData({...shoppingFormData, priority: e.target.value as any})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
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
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <input
              type="text"
              placeholder="Supplier"
              value={shoppingFormData.supplier}
              onChange={(e) => setShoppingFormData({...shoppingFormData, supplier: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <textarea
              placeholder="Notes"
              value={shoppingFormData.notes}
              onChange={(e) => setShoppingFormData({...shoppingFormData, notes: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 min-h-[60px]"
            />

            <div className="flex gap-2 mt-4">
              <button onClick={handleAddShoppingItem} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Add Item
              </button>
              <button onClick={() => setAddShoppingItemModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}