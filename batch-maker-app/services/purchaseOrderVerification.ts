// ============================================================
// services/purchaseOrderVerification.ts
// Verify received quantities against ordered quantities
// Track discrepancies, backorders, and supplier issues
// ============================================================

import { supabase } from '../app/lib/supabase';

// ============================================================
// TYPES
// ============================================================

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  ingredient_name: string;
  quantity_ordered: number;
  unit: string;
  unit_cost: number;
  supplier_sku?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  user_id: string;
  supplier_name: string;
  order_date: string;
  expected_delivery_date?: string;
  status: 'pending' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';
  total_ordered_cost: number;
  total_received_cost: number;
  notes?: string;
  created_at: string;
  items: PurchaseOrderItem[];
}

export interface ReceiptLineItem {
  po_item_id: string;
  ingredient_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit: string;
  unit_cost: number;
  condition: 'good' | 'damaged' | 'expired';
  notes?: string;
}

export interface DiscrepancyType {
  'short': 'Received less than ordered';
  'backorder': 'Item backordered by supplier';
  'damaged': 'Item received damaged';
  'extra': 'Received more than ordered';
  'missing': 'Item not included in delivery';
  'expired': 'Item received expired or near expiry';
}

export interface PODiscrepancy {
  id: string;
  po_id: string;
  po_item_id: string;
  ingredient_name: string;
  discrepancy_type: keyof DiscrepancyType;
  quantity_ordered: number;
  quantity_received: number;
  unit: string;
  unit_cost: number;
  variance_amount: number;      // quantity_received - quantity_ordered
  variance_cost: number;        // variance_amount * unit_cost
  notes?: string | null;
  resolved: boolean;
  resolution_notes?: string | null;
  created_at: string;
}

export interface ReceiptVerificationResult {
  po_id: string;
  po_status: PurchaseOrder['status'];
  line_items: {
    po_item_id: string;
    ingredient_name: string;
    quantity_ordered: number;
    quantity_received: number;
    unit: string;
    status: 'matched' | 'short' | 'extra' | 'missing' | 'damaged';
    variance: number;
    variance_cost: number;
  }[];
  discrepancies: PODiscrepancy[];
  total_ordered_cost: number;
  total_received_cost: number;
  total_variance_cost: number;
  summary: string;
}

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Create a new purchase order with line items
 */
export async function createPurchaseOrder(
  userId: string,
  supplierName: string,
  orderDate: string,
  expectedDelivery: string | null,
  items: Omit<PurchaseOrderItem, 'id' | 'po_id'>[],
  notes?: string
): Promise<{ success: boolean; po?: PurchaseOrder; error?: string }> {
  try {
    const totalCost = items.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_cost), 0);

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        user_id: userId,
        supplier_name: supplierName,
        order_date: orderDate,
        expected_delivery_date: expectedDelivery,
        status: 'pending',
        total_ordered_cost: totalCost,
        total_received_cost: 0,
        notes: notes || null,
      })
      .select('*')
      .single();

    if (poError) return { success: false, error: poError.message };

    // Insert line items
    const lineItems = items.map(item => ({
      po_id: po.id,
      ingredient_name: item.ingredient_name,
      quantity_ordered: item.quantity_ordered,
      unit: item.unit,
      unit_cost: item.unit_cost,
      supplier_sku: item.supplier_sku || null,
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(lineItems);

    if (itemsError) return { success: false, error: itemsError.message };

    // Fetch and return full PO with items
    return { success: true, po: await fetchPurchaseOrder(po.id) as PurchaseOrder };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch a purchase order with its line items
 */
export async function fetchPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
  const { data: po } = await supabase.from('purchase_orders').select('*').eq('id', poId).single();
  if (!po) return null;

  const { data: items } = await supabase.from('purchase_order_items').select('*').eq('po_id', poId);
  return { ...po, items: items || [] };
}

/**
 * Fetch all purchase orders for a user
 */
export async function fetchPurchaseOrders(userId: string): Promise<PurchaseOrder[]> {
  const { data: orders } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('user_id', userId)
    .order('order_date', { ascending: false });

  if (!orders) return [];

  const results: PurchaseOrder[] = [];
  for (const order of orders) {
    const { data: items } = await supabase.from('purchase_order_items').select('*').eq('po_id', order.id);
    results.push({ ...order, items: items || [] });
  }
  return results;
}

/**
 * CORE FUNCTION: Verify a receipt against the purchase order.
 * This is where ordered vs received quantities are confirmed.
 * Automatically detects and logs all discrepancies.
 */
export async function verifyPurchaseOrderReceipt(
  poId: string,
  receivedItems: ReceiptLineItem[],
  receivedByUserId: string
): Promise<{ success: boolean; result?: ReceiptVerificationResult; error?: string }> {
  try {
    const po = await fetchPurchaseOrder(poId);
    if (!po) return { success: false, error: 'Purchase order not found' };
    if (po.status === 'received' || po.status === 'cancelled') {
      return { success: false, error: `Cannot verify receipt: PO is already ${po.status}` };
    }

    const discrepancies: PODiscrepancy[] = [];
    const lineResults: ReceiptVerificationResult['line_items'] = [];
    let totalReceivedCost = 0;

    // --- Check each ordered item against what was received ---
    for (const orderedItem of po.items) {
      const received = receivedItems.find(r => r.po_item_id === orderedItem.id);

      if (!received) {
        // Item completely missing from delivery
        lineResults.push({
          po_item_id: orderedItem.id,
          ingredient_name: orderedItem.ingredient_name,
          quantity_ordered: orderedItem.quantity_ordered,
          quantity_received: 0,
          unit: orderedItem.unit,
          status: 'missing',
          variance: -orderedItem.quantity_ordered,
          variance_cost: -(orderedItem.quantity_ordered * orderedItem.unit_cost),
        });

        discrepancies.push({
          id: '',
          po_id: poId,
          po_item_id: orderedItem.id,
          ingredient_name: orderedItem.ingredient_name,
          discrepancy_type: 'missing',
          quantity_ordered: orderedItem.quantity_ordered,
          quantity_received: 0,
          unit: orderedItem.unit,
          unit_cost: orderedItem.unit_cost,
          variance_amount: -orderedItem.quantity_ordered,
          variance_cost: -(orderedItem.quantity_ordered * orderedItem.unit_cost),
          notes: 'Item not included in delivery',
          resolved: false,
          resolution_notes: null,
          created_at: new Date().toISOString(),
        });
        continue;
      }

      const variance = received.quantity_received - orderedItem.quantity_ordered;
      const varianceCost = variance * orderedItem.unit_cost;
      const receivedCost = received.quantity_received * orderedItem.unit_cost;
      totalReceivedCost += receivedCost;

      // Determine status
      let status: ReceiptVerificationResult['line_items'][0]['status'] = 'matched';
      let discrepancyType: keyof DiscrepancyType | null = null;

      if (received.condition === 'damaged') {
        status = 'damaged';
        discrepancyType = 'damaged';
      } else if (received.condition === 'expired') {
        status = 'damaged';
        discrepancyType = 'expired';
      } else if (variance < 0) {
        status = 'short';
        discrepancyType = 'short';
      } else if (variance > 0) {
        status = 'extra';
        discrepancyType = 'extra';
      }

      lineResults.push({
        po_item_id: orderedItem.id,
        ingredient_name: orderedItem.ingredient_name,
        quantity_ordered: orderedItem.quantity_ordered,
        quantity_received: received.quantity_received,
        unit: orderedItem.unit,
        status,
        variance,
        variance_cost: varianceCost,
      });

      // Log discrepancy if there is one
      if (discrepancyType) {
        discrepancies.push({
          id: '',
          po_id: poId,
          po_item_id: orderedItem.id,
          ingredient_name: orderedItem.ingredient_name,
          discrepancy_type: discrepancyType,
          quantity_ordered: orderedItem.quantity_ordered,
          quantity_received: received.quantity_received,
          unit: orderedItem.unit,
          unit_cost: orderedItem.unit_cost,
          variance_amount: variance,
          variance_cost: varianceCost,
          notes: received.notes || null,
          resolved: false,
          resolution_notes: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    // --- Check for items received that were NOT on the order ---
    for (const received of receivedItems) {
      const wasOrdered = po.items.find(item => item.id === received.po_item_id);
      if (!wasOrdered) {
        lineResults.push({
          po_item_id: received.po_item_id || 'unknown',
          ingredient_name: received.ingredient_name,
          quantity_ordered: 0,
          quantity_received: received.quantity_received,
          unit: received.unit,
          status: 'extra',
          variance: received.quantity_received,
          variance_cost: received.quantity_received * received.unit_cost,
        });

        discrepancies.push({
          id: '',
          po_id: poId,
          po_item_id: received.po_item_id || 'unknown',
          ingredient_name: received.ingredient_name,
          discrepancy_type: 'extra',
          quantity_ordered: 0,
          quantity_received: received.quantity_received,
          unit: received.unit,
          unit_cost: received.unit_cost,
          variance_amount: received.quantity_received,
          variance_cost: received.quantity_received * received.unit_cost,
          notes: 'Item received but not on original order',
          resolved: false,
          resolution_notes: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    // --- Persist to Supabase ---

    // 1. Save receipt line items
    const receiptRecords = receivedItems.map(item => ({
      po_id: poId,
      po_item_id: item.po_item_id,
      ingredient_name: item.ingredient_name,
      quantity_received: item.quantity_received,
      unit: item.unit,
      unit_cost: item.unit_cost,
      condition: item.condition,
      received_by: receivedByUserId,
      received_at: new Date().toISOString(),
      notes: item.notes || null,
    }));

    await supabase.from('po_receipts').insert(receiptRecords);

    // 2. Save discrepancies
    if (discrepancies.length > 0) {
      const discrepancyRecords = discrepancies.map(d => ({
        po_id: d.po_id,
        po_item_id: d.po_item_id,
        ingredient_name: d.ingredient_name,
        discrepancy_type: d.discrepancy_type,
        quantity_ordered: d.quantity_ordered,
        quantity_received: d.quantity_received,
        unit: d.unit,
        unit_cost: d.unit_cost,
        variance_amount: d.variance_amount,
        variance_cost: d.variance_cost,
        notes: d.notes,
        resolved: false,
        created_at: new Date().toISOString(),
      }));

      await supabase.from('po_discrepancies').insert(discrepancyRecords);
    }

    // 3. Update PO status and received cost
    const allReceived = discrepancies.length === 0;
    const hasShortages = discrepancies.some(d => d.discrepancy_type === 'short' || d.discrepancy_type === 'missing' || d.discrepancy_type === 'backorder');
    const newStatus = allReceived ? 'received' : hasShortages ? 'partially_received' : 'received';

    await supabase.from('purchase_orders').update({
      status: newStatus,
      total_received_cost: totalReceivedCost,
    }).eq('id', poId);

    // 4. Create notification for discrepancies
    if (discrepancies.length > 0) {
      const po_owner = po.user_id;
      await supabase.from('notifications').insert({
        type: 'po_discrepancy',
        message: `⚠️ PO from ${po.supplier_name} has ${discrepancies.length} discrepancy(ies). Check the Purchase Orders section.`,
        user_id: po_owner,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    // --- Build summary ---
    const totalVarianceCost = discrepancies.reduce((sum, d) => sum + d.variance_cost, 0);
    const matchedCount = lineResults.filter(l => l.status === 'matched').length;
    const totalItems = po.items.length;

    let summary = '';
    if (discrepancies.length === 0) {
      summary = `✅ Receipt verified. All ${totalItems} items match the order exactly.`;
    } else {
      const issues = discrepancies.map(d => {
        switch (d.discrepancy_type) {
          case 'short': return `${d.ingredient_name}: received ${d.quantity_received} of ${d.quantity_ordered} ${d.unit}`;
          case 'missing': return `${d.ingredient_name}: completely missing`;
          case 'extra': return `${d.ingredient_name}: received ${d.quantity_received} (ordered ${d.quantity_ordered})`;
          case 'damaged': return `${d.ingredient_name}: received damaged`;
          case 'expired': return `${d.ingredient_name}: received expired`;
          case 'backorder': return `${d.ingredient_name}: backordered`;
        }
      });
      summary = `⚠️ ${matchedCount}/${totalItems} items matched. Issues: ${issues.join('; ')}. Variance: $${Math.abs(totalVarianceCost).toFixed(2)}`;
    }

    return {
      success: true,
      result: {
        po_id: poId,
        po_status: newStatus,
        line_items: lineResults,
        discrepancies,
        total_ordered_cost: po.total_ordered_cost,
        total_received_cost: totalReceivedCost,
        total_variance_cost: totalVarianceCost,
        summary,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get discrepancy summary for a PO
 */
export async function getPODiscrepancySummary(poId: string): Promise<PODiscrepancy[]> {
  const { data } = await supabase
    .from('po_discrepancies')
    .select('*')
    .eq('po_id', poId)
    .order('created_at', { ascending: false });
  return data || [];
}

/**
 * Resolve a discrepancy
 */
export async function resolveDiscrepancy(discrepancyId: string, resolutionNotes: string): Promise<boolean> {
  const { error } = await supabase
    .from('po_discrepancies')
    .update({ resolved: true, resolution_notes: resolutionNotes })
    .eq('id', discrepancyId);
  return !error;
}

/**
 * Update PO status (e.g. mark as in_transit when shipped)
 */
export async function updatePOStatus(poId: string, newStatus: PurchaseOrder['status']): Promise<boolean> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: newStatus })
    .eq('id', poId);
  return !error;
}