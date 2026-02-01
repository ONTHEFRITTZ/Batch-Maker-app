import { useState } from 'react';
import type { DashboardProps } from '../lib/dashboard-types';
import { supabase } from '../lib/supabase';

export default function Overview({
  workflows,
  inventoryItems,
  scheduledBatches,
  batchReports,
  batchTemplates,
  shoppingList,
  user,
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

  const lowStockItems = inventoryItems.filter(item => 
    item.low_stock_threshold && item.quantity <= item.low_stock_threshold
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-gray-900 mb-1">{workflows.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Workflows</div>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-gray-900 mb-1">{inventoryItems.length}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Inventory Items</div>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className={`text-3xl font-bold mb-1 ${lowStockItems.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {lowStockItems.length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Low Stock Alerts</div>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {scheduledBatches.filter(b => b.status === 'scheduled').length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Scheduled Batches</div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">30-Day Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Batches Completed</div>
            <div className="text-xl font-semibold text-gray-900">{recentReports.length}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Total Revenue</div>
            <div className="text-xl font-semibold text-gray-900">${totalRevenue30d.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Total Cost</div>
            <div className="text-xl font-semibold text-gray-900">${totalCost30d.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Profit</div>
            <div className={`text-xl font-semibold ${profit30d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${profit30d.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-red-700 mb-4">⚠️ Low Stock Alerts</h3>
          <div className="space-y-3">
            {lowStockItems.map(item => (
              <div key={item.id} className="p-4 bg-white rounded-lg border border-red-200 flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900 mb-1">{item.name}</div>
                  <div className="text-sm text-gray-500">
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
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors whitespace-nowrap"
                >
                  Add to Order List
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Shopping Item Modal */}
      {addShoppingItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAddShoppingItemModalOpen(false)}>
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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