import { useState } from 'react';
import type { DashboardProps } from '../lib/dashboard-types';
import { supabase } from '../lib/supabase';

export default function Inventory({
  user,
  inventoryItems,
  inventoryTransactions,
  shoppingList,
  fetchInventoryItems,
  fetchInventoryTransactions,
  fetchShoppingList,
}: DashboardProps) {
  const [addInventoryModalOpen, setAddInventoryModalOpen] = useState(false);
  const [inventoryTransactionModalOpen, setInventoryTransactionModalOpen] = useState(false);
  const [addShoppingItemModalOpen, setAddShoppingItemModalOpen] = useState(false);

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

  const [transactionFormData, setTransactionFormData] = useState({
    item_id: '',
    type: 'use' as 'add' | 'use' | 'adjust' | 'waste',
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

      await fetchInventoryItems();
      await fetchInventoryTransactions();
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
    const { error } = await supabase
      .from('shopping_list')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) await fetchShoppingList();
  }

  return (
    <>
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Inventory Management</h2>
          <div className="flex gap-3">
            <button onClick={() => setInventoryTransactionModalOpen(true)} className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              📝 Record Transaction
            </button>
            <button onClick={() => setAddInventoryModalOpen(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              + Add Item
            </button>
          </div>
        </div>

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

        {inventoryItems.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-8">No inventory items yet. Add items to start tracking!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventoryItems.map(item => {
              const isLowStock = item.low_stock_threshold && item.quantity <= item.low_stock_threshold;
              const itemValue = item.quantity * (item.cost_per_unit || 0);
              
              return (
                <div key={item.id} className={`p-6 bg-gray-50 rounded-lg border-2 ${isLowStock ? 'border-red-500' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="font-semibold text-gray-900">{item.name}</div>
                    {item.category && <div className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">{item.category}</div>}
                  </div>
                  
                  <div className="mb-2">
                    <span className={`text-2xl font-semibold ${isLowStock ? 'text-red-500' : 'text-gray-900'}`}>
                      {item.quantity}
                    </span>
                    <span className="ml-2 text-gray-500">{item.unit}</span>
                  </div>
                  
                  {item.low_stock_threshold && (
                    <div className={`text-xs mb-2 ${isLowStock ? 'text-red-500' : 'text-gray-500'}`}>
                      {isLowStock ? '⚠️ Low Stock' : '✓ In Stock'} (Threshold: {item.low_stock_threshold} {item.unit})
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 mb-2">
                    {item.cost_per_unit && <div>Cost: ${item.cost_per_unit}/{item.unit}</div>}
                    {itemValue > 0 && <div>Value: ${itemValue.toFixed(2)}</div>}
                    {item.supplier && <div>Supplier: {item.supplier}</div>}
                  </div>
                  
                  {item.notes && <div className="text-xs text-gray-500 italic mt-2 mb-2">{item.notes}</div>}
                  
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => {
                        setTransactionFormData({...transactionFormData, item_id: item.id, type: 'use'});
                        setInventoryTransactionModalOpen(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
                    >
                      Use
                    </button>
                    <button 
                      onClick={() => {
                        setTransactionFormData({...transactionFormData, item_id: item.id, type: 'add'});
                        setInventoryTransactionModalOpen(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
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

      {/* Shopping(order) List */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
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
                    <button onClick={() => updateShoppingItemStatus(item.id, 'received')} className="w-full px-3 py-1 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 transition-colors">
                      Mark Received
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        {inventoryTransactions.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {inventoryTransactions.slice(0, 10).map(trans => {
              const item = inventoryItems.find(i => i.id === trans.item_id);
              return (
                <div key={trans.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-2xl w-10 h-10 flex items-center justify-center bg-white rounded-full">
                    {trans.type === 'add' ? '➕' : trans.type === 'use' ? '➖' : trans.type === 'waste' ? '🗑️' : '🔄'}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {trans.type.toUpperCase()}: {item?.name || 'Unknown Item'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {trans.quantity} {item?.unit} • {trans.created_by} • {new Date(trans.created_at).toLocaleString()}
                    </div>
                    {trans.notes && <div className="text-xs text-gray-500 italic mt-1">{trans.notes}</div>}
                  </div>
                  {trans.cost && (
                    <div className="text-base font-semibold text-gray-900">${trans.cost.toFixed(2)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {/* Inventory Transaction Modal */}
      {inventoryTransactionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setInventoryTransactionModalOpen(false)}>
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Record Inventory Transaction</h3>
            
            <select
              value={transactionFormData.item_id}
              onChange={(e) => setTransactionFormData({...transactionFormData, item_id: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
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
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
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
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <input
              type="number"
              step="0.01"
              placeholder="Cost (optional)"
              value={transactionFormData.cost || ''}
              onChange={(e) => setTransactionFormData({...transactionFormData, cost: parseFloat(e.target.value) || 0})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <textarea
              placeholder="Notes"
              value={transactionFormData.notes}
              onChange={(e) => setTransactionFormData({...transactionFormData, notes: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 min-h-[80px]"
            />

            <div className="flex gap-2">
              <button onClick={handleInventoryTransaction} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Record Transaction
              </button>
              <button onClick={() => setInventoryTransactionModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
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