import { useState } from 'react';
import type { DashboardProps, InventoryItem } from '../lib/dashboard-types';
import { getSupabaseClient } from '../lib/supabase';

const supabase = getSupabaseClient();

export default function Inventory({
  user,
  inventoryItems,
  inventoryTransactions,
  shoppingList,
  fetchInventoryItems,
  fetchInventoryTransactions,
  fetchShoppingList,
}: DashboardProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [addInventoryModalOpen, setAddInventoryModalOpen] = useState(false);
  const [bulkTransactionModalOpen, setBulkTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'add' | 'use'>('use');
  const [addShoppingItemModalOpen, setAddShoppingItemModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const [bulkTransactionData, setBulkTransactionData] = useState({
    quantity: 0,
    cost: 0,
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

  const lowStockItems = inventoryItems.filter(item => 
    item.low_stock_threshold && item.quantity <= item.low_stock_threshold
  );

  const totalInventoryValue = inventoryItems.reduce((sum, item) => 
    sum + (item.quantity * (item.cost_per_unit || 0)), 0
  );

  const filteredItems = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.supplier?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (!item.low_stock_threshold) return { label: 'OK', color: 'bg-gray-100 text-gray-600' };
    if (item.quantity === 0) return { label: 'Out', color: 'bg-red-100 text-red-700' };
    if (item.quantity <= item.low_stock_threshold * 0.5) return { label: 'Critical', color: 'bg-red-100 text-red-700' };
    if (item.quantity <= item.low_stock_threshold) return { label: 'Low', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'OK', color: 'bg-green-100 text-green-700' };
  };

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

      await fetchInventoryItems();
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

  async function handleUpdateInventoryItem() {
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({
          name: editingItem.name,
          quantity: editingItem.quantity,
          unit: editingItem.unit,
          low_stock_threshold: editingItem.low_stock_threshold,
          cost_per_unit: editingItem.cost_per_unit,
          supplier: editingItem.supplier,
          category: editingItem.category,
          notes: editingItem.notes,
          last_updated: new Date().toISOString(),
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      await fetchInventoryItems();
      setEditingItem(null);
      alert('Item updated successfully!');
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    }
  }

  async function handleBulkTransaction() {
    if (selectedItems.size === 0 || bulkTransactionData.quantity <= 0) {
      alert('Please select items and enter quantity');
      return;
    }

    try {
      for (const itemId of Array.from(selectedItems)) {
        const item = inventoryItems.find(i => i.id === itemId);
        if (!item) continue;

        let newQuantity = item.quantity;
        if (transactionType === 'use') {
          newQuantity -= bulkTransactionData.quantity;
        } else {
          newQuantity += bulkTransactionData.quantity;
        }

        // Insert transaction
        await supabase.from('inventory_transactions').insert({
          user_id: user.id,
          item_id: itemId,
          type: transactionType,
          quantity: bulkTransactionData.quantity,
          cost: bulkTransactionData.cost || null,
          notes: bulkTransactionData.notes,
          created_by: user.email,
          created_at: new Date().toISOString(),
        });

        // Update item quantity
        await supabase
          .from('inventory_items')
          .update({ 
            quantity: Math.max(0, newQuantity),
            last_updated: new Date().toISOString()
          })
          .eq('id', itemId);
      }

      await fetchInventoryItems();
      await fetchInventoryTransactions();
      setBulkTransactionModalOpen(false);
      setSelectedItems(new Set());
      setBulkTransactionData({ quantity: 0, cost: 0, notes: '' });
      alert(`Transaction recorded for ${selectedItems.size} item(s)`);
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

  async function updateShoppingItemStatus(id: string, status: 'pending' | 'ordered' | 'received') {
    try {
      const { error: updateError } = await supabase
        .from('shopping_list')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw updateError;

      if (status === 'received') {
        const shoppingItem = shoppingList.find(item => item.id === id);
        if (!shoppingItem) return;

        const existingItem = inventoryItems.find(
          item => item.name.toLowerCase() === shoppingItem.item_name.toLowerCase()
        );

        if (existingItem) {
          const newQuantity = existingItem.quantity + shoppingItem.quantity;
          
          await supabase
            .from('inventory_items')
            .update({ 
              quantity: newQuantity,
              last_updated: new Date().toISOString()
            })
            .eq('id', existingItem.id);

          await supabase.from('inventory_transactions').insert({
            user_id: user.id,
            item_id: existingItem.id,
            type: 'add',
            quantity: shoppingItem.quantity,
            cost: shoppingItem.estimated_cost || null,
            notes: `Added from order list`,
            created_by: user.email,
            created_at: new Date().toISOString(),
          });
        } else {
          const { data: newItem } = await supabase
            .from('inventory_items')
            .insert({
              user_id: user.id,
              name: shoppingItem.item_name,
              quantity: shoppingItem.quantity,
              unit: shoppingItem.unit,
              supplier: shoppingItem.supplier || '',
              cost_per_unit: shoppingItem.estimated_cost && shoppingItem.quantity > 0 
                ? shoppingItem.estimated_cost / shoppingItem.quantity 
                : 0,
              low_stock_threshold: 0,
              category: '',
              notes: shoppingItem.notes || '',
              last_updated: new Date().toISOString(),
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (newItem) {
            await supabase.from('inventory_transactions').insert({
              user_id: user.id,
              item_id: newItem.id,
              type: 'add',
              quantity: shoppingItem.quantity,
              cost: shoppingItem.estimated_cost || null,
              notes: `Initial stock from order list`,
              created_by: user.email,
              created_at: new Date().toISOString(),
            });
          }
        }

        await fetchInventoryItems();
        await fetchInventoryTransactions();
      }

      await fetchShoppingList();
    } catch (error) {
      console.error('Error updating shopping item:', error);
      alert('Failed to update shopping item status');
    }
  }

  return (
    <>
      {/* Inventory Management */}
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Inventory Management</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="🔍 Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-xs text-gray-500 uppercase mb-2">Total Items</div>
            <div className="text-2xl font-bold text-gray-900">{inventoryItems.length}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-xs text-gray-500 uppercase mb-2">Total Value</div>
            <div className="text-2xl font-bold text-gray-900">${totalInventoryValue.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-xs text-gray-500 uppercase mb-2">Low Stock Items</div>
            <div className="text-2xl font-bold text-red-500">{lowStockItems.length}</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex gap-3 mb-4 pb-4 border-b border-gray-200">
          <button
            onClick={() => {
              if (selectedItems.size === 0) {
                alert('Please select items first');
                return;
              }
              setTransactionType('add');
              setBulkTransactionModalOpen(true);
            }}
            disabled={selectedItems.size === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedItems.size === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            ➕ Add Stock ({selectedItems.size})
          </button>
          <button
            onClick={() => {
              if (selectedItems.size === 0) {
                alert('Please select items first');
                return;
              }
              setTransactionType('use');
              setBulkTransactionModalOpen(true);
            }}
            disabled={selectedItems.size === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedItems.size === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            ➖ Use Stock ({selectedItems.size})
          </button>
          <button
            onClick={() => setAddInventoryModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            + New Item
          </button>
        </div>

        {/* Compact List */}
        {inventoryItems.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-8">No inventory items yet. Add items to start tracking!</p>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center px-4 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600">
              <div className="w-10">
                <input
                  type="checkbox"
                  checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                  onChange={selectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">Name</div>
              <div className="w-32 text-right">Quantity</div>
              <div className="w-24 text-center">Status</div>
            </div>

            {/* Items */}
            {filteredItems.map(item => {
              const status = getStockStatus(item);
              const isSelected = selectedItems.has(item.id);
              
              return (
                <div
                  key={item.id}
                  className={`flex items-center px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItemSelection(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => setEditingItem(item)}
                  >
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.category && <span>{item.category}</span>}
                      {item.supplier && <span> • {item.supplier}</span>}
                      {item.cost_per_unit && <span> • ${item.cost_per_unit}/{item.unit}</span>}
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <span className={`text-base font-semibold ${
                      status.label === 'Critical' || status.label === 'Out' ? 'text-red-600' :
                      status.label === 'Low' ? 'text-yellow-600' : 'text-gray-900'
                    }`}>
                      {item.quantity}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">{item.unit}</span>
                  </div>
                  <div className="w-24 text-center">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shopping List */}
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Order List</h2>
          <button onClick={() => setAddShoppingItemModalOpen(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            + Add Item
          </button>
        </div>

        {shoppingList.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-8">Order list is empty.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">📋 Pending</h3>
              <div className="space-y-3">
                {shoppingList.filter(i => i.status === 'pending').map(item => (
                  <div key={item.id} className={`bg-white p-4 rounded-lg border-l-4 ${
                    item.priority === 'urgent' ? 'border-red-500' :
                    item.priority === 'high' ? 'border-yellow-500' : 'border-blue-500'
                  } border border-gray-200`}>
                    <div className="text-sm font-medium text-gray-900 mb-1">{item.item_name}</div>
                    <div className="text-xs text-gray-500 mb-2">
                      {item.quantity} {item.unit}
                      {item.estimated_cost && ` • $${item.estimated_cost.toFixed(2)}`}
                    </div>
                    {item.supplier && <div className="text-xs text-blue-600 mb-2">Supplier: {item.supplier}</div>}
                    <button onClick={() => updateShoppingItemStatus(item.id, 'ordered')} className="w-full px-3 py-1 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 transition-colors">
                      Mark Ordered
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">📦 Ordered</h3>
              <div className="space-y-3">
                {shoppingList.filter(i => i.status === 'ordered').map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-sm font-medium text-gray-900 mb-1">{item.item_name}</div>
                    <div className="text-xs text-gray-500 mb-2">{item.quantity} {item.unit}</div>
                    <button onClick={() => updateShoppingItemStatus(item.id, 'received')} className="w-full px-3 py-1 bg-green-500 text-white rounded-md text-xs hover:bg-green-600 transition-colors">
                      Mark Received ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">✅ Received</h3>
              <div className="space-y-3">
                {shoppingList.filter(i => i.status === 'received').slice(0, 5).map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200 opacity-70">
                    <div className="text-sm font-medium text-gray-900 mb-1">{item.item_name}</div>
                    <div className="text-xs text-gray-500">{item.quantity} {item.unit}</div>
                    <div className="text-xs text-green-600 mt-1">✓ Added to inventory</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        {inventoryTransactions.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {inventoryTransactions.slice(0, 10).map(trans => {
              const item = inventoryItems.find(i => i.id === trans.item_id);
              return (
                <div key={trans.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xl w-8 h-8 flex items-center justify-center">
                    {trans.type === 'add' ? '➕' : trans.type === 'use' ? '➖' : trans.type === 'waste' ? '🗑️' : '🔄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {trans.type.toUpperCase()}: {item?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {trans.quantity} {item?.unit} • {new Date(trans.created_at).toLocaleString()}
                    </div>
                  </div>
                  {trans.cost && (
                    <div className="text-sm font-semibold text-gray-900">${trans.cost.toFixed(2)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingItem(null)}>
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Edit Item</h3>
            
            <input
              type="text"
              placeholder="Item name"
              value={editingItem.name}
              onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="Quantity"
                value={editingItem.quantity || ''}
                onChange={(e) => setEditingItem({...editingItem, quantity: parseFloat(e.target.value) || 0})}
                className="flex-[2] p-3 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Unit"
                value={editingItem.unit}
                onChange={(e) => setEditingItem({...editingItem, unit: e.target.value})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="Low stock threshold"
                value={editingItem.low_stock_threshold || ''}
                onChange={(e) => setEditingItem({...editingItem, low_stock_threshold: parseFloat(e.target.value) || 0})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cost per unit"
                value={editingItem.cost_per_unit || ''}
                onChange={(e) => setEditingItem({...editingItem, cost_per_unit: parseFloat(e.target.value) || 0})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <input
              type="text"
              placeholder="Supplier"
              value={editingItem.supplier || ''}
              onChange={(e) => setEditingItem({...editingItem, supplier: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <input
              type="text"
              placeholder="Category"
              value={editingItem.category || ''}
              onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <textarea
              placeholder="Notes"
              value={editingItem.notes || ''}
              onChange={(e) => setEditingItem({...editingItem, notes: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 min-h-[80px]"
            />

            <div className="flex gap-2">
              <button onClick={handleUpdateInventoryItem} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Save Changes
              </button>
              <button onClick={() => setEditingItem(null)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Transaction Modal */}
      {bulkTransactionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBulkTransactionModalOpen(false)}>
          <div className="bg-white rounded-xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">
              {transactionType === 'add' ? '➕ Add Stock' : '➖ Use Stock'}
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-gray-900 mb-1">Selected Items ({selectedItems.size}):</div>
              <div className="text-xs text-gray-600">
                {Array.from(selectedItems).map(id => {
                  const item = inventoryItems.find(i => i.id === id);
                  return item?.name;
                }).join(', ')}
              </div>
            </div>

            <input
              type="number"
              step="0.01"
              placeholder="Quantity *"
              value={bulkTransactionData.quantity || ''}
              onChange={(e) => setBulkTransactionData({...bulkTransactionData, quantity: parseFloat(e.target.value) || 0})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <input
              type="number"
              step="0.01"
              placeholder="Cost (optional)"
              value={bulkTransactionData.cost || ''}
              onChange={(e) => setBulkTransactionData({...bulkTransactionData, cost: parseFloat(e.target.value) || 0})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <textarea
              placeholder="Notes"
              value={bulkTransactionData.notes}
              onChange={(e) => setBulkTransactionData({...bulkTransactionData, notes: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 min-h-[80px]"
            />

            <div className="flex gap-2">
              <button onClick={handleBulkTransaction} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Record Transaction
              </button>
              <button onClick={() => setBulkTransactionModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Inventory Item Modal */}
      {addInventoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAddInventoryModalOpen(false)}>
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Add Inventory Item</h3>
            
            <input
              type="text"
              placeholder="Item name *"
              value={inventoryFormData.name}
              onChange={(e) => setInventoryFormData({...inventoryFormData, name: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="Quantity *"
                value={inventoryFormData.quantity || ''}
                onChange={(e) => setInventoryFormData({...inventoryFormData, quantity: parseFloat(e.target.value) || 0})}
                className="flex-[2] p-3 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Unit *"
                value={inventoryFormData.unit}
                onChange={(e) => setInventoryFormData({...inventoryFormData, unit: e.target.value})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="Low stock threshold"
                value={inventoryFormData.low_stock_threshold || ''}
                onChange={(e) => setInventoryFormData({...inventoryFormData, low_stock_threshold: parseFloat(e.target.value) || 0})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cost per unit"
                value={inventoryFormData.cost_per_unit || ''}
                onChange={(e) => setInventoryFormData({...inventoryFormData, cost_per_unit: parseFloat(e.target.value) || 0})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <input
              type="text"
              placeholder="Supplier"
              value={inventoryFormData.supplier}
              onChange={(e) => setInventoryFormData({...inventoryFormData, supplier: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <input
              type="text"
              placeholder="Category"
              value={inventoryFormData.category}
              onChange={(e) => setInventoryFormData({...inventoryFormData, category: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <textarea
              placeholder="Notes"
              value={inventoryFormData.notes}
              onChange={(e) => setInventoryFormData({...inventoryFormData, notes: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 min-h-[80px]"
            />

            <div className="flex gap-2">
              <button onClick={handleAddInventoryItem} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Add Item
              </button>
              <button onClick={() => setAddInventoryModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Shopping List Item Modal */}
      {addShoppingItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAddShoppingItemModalOpen(false)}>
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Add to Order List</h3>
            
            <input
              type="text"
              placeholder="Item name *"
              value={shoppingFormData.item_name}
              onChange={(e) => setShoppingFormData({...shoppingFormData, item_name: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="Quantity *"
                value={shoppingFormData.quantity || ''}
                onChange={(e) => setShoppingFormData({...shoppingFormData, quantity: parseFloat(e.target.value) || 0})}
                className="flex-[2] p-3 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Unit *"
                value={shoppingFormData.unit}
                onChange={(e) => setShoppingFormData({...shoppingFormData, unit: e.target.value})}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
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

            <div className="flex gap-2">
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