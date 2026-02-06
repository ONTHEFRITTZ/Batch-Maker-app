import type { DashboardProps } from '../lib/dashboard-types';

export default function Analytics({
  batchReports,
  batchTemplates,
  inventoryItems,
  inventoryTransactions,
  scheduledBatches,
}: DashboardProps) {
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

  const lowStockItems = inventoryItems.filter(item => 
    item.low_stock_threshold && item.quantity <= item.low_stock_threshold
  );

  const totalInventoryValue = inventoryItems.reduce((sum, item) => 
    sum + (item.quantity * (item.cost_per_unit || 0)), 0
  );

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
    <>
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Advanced Analytics</h2>
        
        <h3 className="text-base font-semibold text-gray-900 mt-6 mb-4">Top 5 Workflows by Completion</h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-4 bg-gray-50 p-3 font-semibold text-sm text-gray-700 border-b border-gray-200">
            <div className="px-2">Workflow</div>
            <div className="px-2">Completions</div>
            <div className="px-2">Avg Duration</div>
            <div className="px-2">Avg Cost</div>
          </div>
          {topWorkflows.map(wf => (
            <div key={wf.name} className="grid grid-cols-4 p-3 text-sm border-b border-gray-200 last:border-b-0">
              <div className="px-2">{wf.name}</div>
              <div className="px-2">{wf.count}</div>
              <div className="px-2">{Math.round(wf.avgDuration)} min</div>
              <div className="px-2">${wf.avgCost.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue & Profitability</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">All-Time Revenue</div>
            <div className="text-xl font-semibold text-gray-900">
              ${batchTemplates.reduce((sum, t) => sum + ((t.selling_price || 0) * t.times_used), 0).toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">All-Time Costs</div>
            <div className="text-xl font-semibold text-gray-900">
              ${batchReports.reduce((sum, r) => sum + (r.total_cost || 0), 0).toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">30-Day Profit</div>
            <div className={`text-xl font-semibold ${profit30d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${profit30d.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">30-Day Margin</div>
            <div className={`text-xl font-semibold ${profitMargin30d >= 20 ? 'text-green-500' : 'text-yellow-500'}`}>
              {profitMargin30d.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Inventory Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Total Items</div>
            <div className="text-xl font-semibold text-gray-900">{inventoryItems.length}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Inventory Value</div>
            <div className="text-xl font-semibold text-gray-900">${totalInventoryValue.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Low Stock Alerts</div>
            <div className="text-xl font-semibold text-red-500">{lowStockItems.length}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Transactions (30d)</div>
            <div className="text-xl font-semibold text-gray-900">
              {inventoryTransactions.filter(t => {
                const transDate = new Date(t.created_at);
                return transDate >= last30Days;
              }).length}
            </div>
          </div>
        </div>

        <h3 className="text-base font-semibold text-gray-900 mt-8 mb-4">Inventory by Category</h3>
        <div className="space-y-2">
          {Object.entries(
            inventoryItems.reduce((acc, item) => {
              const cat = item.category || 'Uncategorized';
              if (!acc[cat]) acc[cat] = { count: 0, value: 0 };
              acc[cat].count++;
              acc[cat].value += item.quantity * (item.cost_per_unit || 0);
              return acc;
            }, {} as Record<string, { count: number; value: number }>)
          ).map(([category, data]) => (
            <div key={category} className="p-3 bg-gray-50 rounded-md border border-gray-200 flex justify-between items-center">
              <div className="font-medium text-gray-900">{category}</div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{data.count} items</span>
                <span>${data.value.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Production Trends</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Batches This Week</div>
            <div className="text-xl font-semibold text-gray-900">
              {batchReports.filter(r => {
                const reportDate = new Date(r.timestamp);
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                return reportDate >= weekStart;
              }).length}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Batches This Month</div>
            <div className="text-xl font-semibold text-gray-900">
              {batchReports.filter(r => {
                const reportDate = new Date(r.timestamp);
                const now = new Date();
                return reportDate.getMonth() === now.getMonth() && 
                       reportDate.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Avg Batch Duration</div>
            <div className="text-xl font-semibold text-gray-900">
              {recentReports.length > 0 
                ? Math.round(recentReports.reduce((sum, r) => sum + (r.actual_duration || 0), 0) / recentReports.length / 60) 
                : 0} min
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Scheduled Ahead</div>
            <div className="text-xl font-semibold text-gray-900">
              {scheduledBatches.filter(b => b.status === 'scheduled').length}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}