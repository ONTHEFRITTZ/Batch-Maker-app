import { useState } from 'react';
import type { DashboardProps } from '../lib/dashboard-types';
import { supabase } from '../lib/supabase';

export default function Calendar({
  user,
  workflows,
  scheduledBatches,
  networkMembers,
  batchTemplates,
  isPremium,
  fetchScheduledBatches,
}: DashboardProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    scheduled_date: '',
    scheduled_time: '',
    assigned_to: '',
    batch_size_multiplier: 1,
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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // FIX: Always include yourself in the assignable list, then append network members.
  const assignableMembers = [
    { id: user.id, label: 'You' },
    ...networkMembers
      .filter(m => m.user_id !== user.id)
      .map(m => ({
        id: m.user_id,
        label: m.profiles?.device_name || m.profiles?.email || 'Unknown',
      })),
  ];

  // Helper: resolve a user_id to a display name
  function resolveAssigneeName(userId: string | null): string | null {
    if (!userId) return null;
    if (userId === user.id) return 'You';
    const member = networkMembers.find(m => m.user_id === userId);
    return member?.profiles?.device_name || member?.profiles?.email || 'Unknown';
  }

  const getCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const calendarDays = getCalendarDays();

  const getBatchesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return scheduledBatches.filter(b => b.scheduled_date === dateStr);
  };

  // ─── SCHEDULE (create new) ───────────────────────────────────────────────
  async function handleScheduleBatch() {
    if (!scheduleFormData.workflow_id || !scheduleFormData.scheduled_date || !scheduleFormData.name) {
      alert('Please fill in required fields');
      return;
    }

    try {
      // FIX: resolve name properly — works for yourself AND network members
      const assignedToName = resolveAssigneeName(scheduleFormData.assigned_to || null);

      const { error } = await supabase.from('scheduled_batches').insert({
        user_id: user.id,
        workflow_id: scheduleFormData.workflow_id,
        template_id: scheduleFormData.template_id || null,
        scheduled_date: scheduleFormData.scheduled_date,
        scheduled_time: scheduleFormData.scheduled_time || null,
        name: scheduleFormData.name,
        batch_size_multiplier: scheduleFormData.batch_size_multiplier,
        assigned_to: scheduleFormData.assigned_to || null,
        assigned_to_name: assignedToName,
        status: 'scheduled',
        notes: scheduleFormData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      await fetchScheduledBatches();
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

  // ─── EDIT (update existing from day-detail panel) ────────────────────────
  function openEditForm(batch: any) {
    setEditingBatchId(batch.id);
    setEditFormData({
      name: batch.name,
      scheduled_date: batch.scheduled_date,
      scheduled_time: batch.scheduled_time || '',
      assigned_to: batch.assigned_to || '',
      batch_size_multiplier: batch.batch_size_multiplier || 1,
      notes: batch.notes || '',
    });
  }

  async function handleSaveEdit() {
    if (!editingBatchId) return;
    try {
      const assignedToName = resolveAssigneeName(editFormData.assigned_to || null);

      const { error } = await supabase
        .from('scheduled_batches')
        .update({
          name: editFormData.name,
          scheduled_date: editFormData.scheduled_date,
          scheduled_time: editFormData.scheduled_time || null,
          assigned_to: editFormData.assigned_to || null,
          assigned_to_name: assignedToName,
          batch_size_multiplier: editFormData.batch_size_multiplier,
          notes: editFormData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingBatchId);

      if (error) throw error;

      await fetchScheduledBatches();
      setEditingBatchId(null);

      // If the date was changed, jump the calendar to the new date so the user sees it
      const newDate = new Date(editFormData.scheduled_date + 'T00:00:00');
      if (newDate.getMonth() !== selectedDate.getMonth() || newDate.getFullYear() !== selectedDate.getFullYear()) {
        setSelectedDate(newDate);
      }
      // Close day panel if the batch moved off the currently-viewed day
      if (selectedDayDate) {
        const currentDayStr = selectedDayDate.toISOString().split('T')[0];
        if (editFormData.scheduled_date !== currentDayStr) {
          setSelectedDayDate(null);
        }
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes');
    }
  }

  // ─── START (early or on-time) ─────────────────────────────────────────────
  async function handleStartBatch(batch: any) {
    try {
      const now = new Date();
      const scheduledDateTime = batch.scheduled_time
        ? new Date(`${batch.scheduled_date}T${batch.scheduled_time}`)
        : new Date(`${batch.scheduled_date}T00:00:00`);

      // If we're starting before the scheduled date/time, adjust to right now
      const updates: any = {
        status: 'in_progress',
        updated_at: now.toISOString(),
      };

      if (now < scheduledDateTime) {
        updates.scheduled_date = now.toISOString().split('T')[0];
        updates.scheduled_time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      }

      const { error } = await supabase
        .from('scheduled_batches')
        .update(updates)
        .eq('id', batch.id);

      if (error) throw error;

      await fetchScheduledBatches();
      // Refresh the day panel so it reflects the status change
      // (batch will still appear but now with in_progress styling)
    } catch (error) {
      console.error('Error starting batch:', error);
      alert('Failed to start batch');
    }
  }

  // ─── CANCEL ──────────────────────────────────────────────────────────────
  async function handleCancelBatch(batchId: string) {
    try {
      const { error } = await supabase
        .from('scheduled_batches')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', batchId);

      if (error) throw error;
      await fetchScheduledBatches();
    } catch (error) {
      console.error('Error cancelling batch:', error);
      alert('Failed to cancel batch');
    }
  }

  // ─── DAY DETAIL: batches for the clicked date ────────────────────────────
  const dayDetailBatches = selectedDayDate ? getBatchesForDate(selectedDayDate) : [];

  // ─── UPCOMING LIST (sorted by date ascending) ───────────────────────────
  const upcomingBatches = [...scheduledBatches]
    .filter(b => b.status === 'scheduled')
    .sort((a, b) => {
      const dateA = a.scheduled_time ? `${a.scheduled_date}T${a.scheduled_time}` : a.scheduled_date;
      const dateB = b.scheduled_time ? `${b.scheduled_date}T${b.scheduled_time}` : b.scheduled_date;
      return dateA.localeCompare(dateB);
    })
    .slice(0, 10);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Calendar Grid ── */}
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Production Calendar</h2>
          <button onClick={() => setScheduleModalOpen(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            + Schedule Batch
          </button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
          >
            ◀ Previous
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </h3>
          <button
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
          >
            Next ▶
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-xs text-gray-500 uppercase">
              {day}
            </div>
          ))}

          {calendarDays.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="aspect-square bg-gray-50 rounded-md"></div>;

            const batchesOnDay = getBatchesForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = selectedDayDate && date.toDateString() === selectedDayDate.toDateString();
            const hasBatches = batchesOnDay.length > 0;

            return (
              <div
                key={date.toISOString()}
                onClick={() => {
                  // Toggle: clicking the same date again closes the panel
                  if (selectedDayDate && date.toDateString() === selectedDayDate.toDateString()) {
                    setSelectedDayDate(null);
                    setEditingBatchId(null);
                  } else {
                    setSelectedDayDate(date);
                    setEditingBatchId(null);
                  }
                }}
                className={`aspect-square border rounded-md p-1.5 relative overflow-hidden transition-all duration-150 ${
                  isSelected
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 cursor-pointer'
                    : hasBatches
                      ? 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                      : isToday
                        ? 'bg-sky-50 border-sky-400'
                        : 'bg-white border-gray-200'
                }`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${isToday ? 'text-sky-600' : 'text-gray-700'}`}>
                  {date.getDate()}
                </div>

                {/* Batch count badge */}
                {hasBatches && (
                  <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center" style={{ width: '18px', height: '18px', fontSize: '9px', fontWeight: 600 }}>
                    {batchesOnDay.length}
                  </div>
                )}

                {/* Tiny batch name pills */}
                <div className="space-y-0.5">
                  {batchesOnDay.slice(0, 2).map(batch => (
                    <div
                      key={batch.id}
                      className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis ${
                        batch.status === 'completed' ? 'bg-green-100 text-green-700' :
                        batch.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                        batch.status === 'cancelled' ? 'bg-red-100 text-red-500 line-through' :
                        'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {batch.name}
                    </div>
                  ))}
                  {batchesOnDay.length > 2 && (
                    <div className="text-[9px] text-gray-500 italic px-1">+{batchesOnDay.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Day Detail Panel ── (appears below calendar when a date is clicked) */}
      {selectedDayDate && (
        <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm border border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              📅 {selectedDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Pre-fill the schedule modal with this date
                  setScheduleFormData(prev => ({
                    ...prev,
                    scheduled_date: selectedDayDate.toISOString().split('T')[0],
                  }));
                  setScheduleModalOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-colors"
              >
                + Add Batch
              </button>
              <button
                onClick={() => { setSelectedDayDate(null); setEditingBatchId(null); }}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
              >
                ✕
              </button>
            </div>
          </div>

          {dayDetailBatches.length === 0 ? (
            <p className="text-gray-400 text-sm italic text-center py-6">Nothing scheduled for this day.</p>
          ) : (
            <div className="space-y-3">
              {dayDetailBatches.map(batch => {
                const workflow = workflows.find(w => w.id === batch.workflow_id);
                const isEditing = editingBatchId === batch.id;

                // ── Editing state ──
                if (isEditing) {
                  return (
                    <div key={batch.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-blue-700">✏️ Editing</span>
                        <button onClick={() => setEditingBatchId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>

                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        placeholder="Batch name"
                        className="w-full p-2 text-sm border border-gray-300 rounded-md mb-2"
                      />

                      <div className="flex gap-2 mb-2">
                        <input
                          type="date"
                          value={editFormData.scheduled_date}
                          onChange={(e) => setEditFormData({ ...editFormData, scheduled_date: e.target.value })}
                          className="flex-[2] p-2 text-sm border border-gray-300 rounded-md"
                        />
                        <input
                          type="time"
                          value={editFormData.scheduled_time}
                          onChange={(e) => setEditFormData({ ...editFormData, scheduled_time: e.target.value })}
                          className="flex-1 p-2 text-sm border border-gray-300 rounded-md"
                        />
                      </div>

                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.batch_size_multiplier}
                        onChange={(e) => setEditFormData({ ...editFormData, batch_size_multiplier: parseFloat(e.target.value) || 1 })}
                        placeholder="Size multiplier"
                        className="w-full p-2 text-sm border border-gray-300 rounded-md mb-2"
                      />

                      <select
                        value={editFormData.assigned_to}
                        onChange={(e) => setEditFormData({ ...editFormData, assigned_to: e.target.value })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-md mb-2"
                      >
                        <option value="">Unassigned</option>
                        {assignableMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>

                      <textarea
                        value={editFormData.notes}
                        onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                        placeholder="Notes"
                        className="w-full p-2 text-sm border border-gray-300 rounded-md mb-3 min-h-[50px]"
                      />

                      <button
                        onClick={handleSaveEdit}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  );
                }

                // ── View state ──
                return (
                  <div
                    key={batch.id}
                    className={`p-4 rounded-lg border flex justify-between items-start gap-3 ${
                      batch.status === 'completed' ? 'bg-green-50 border-green-200' :
                      batch.status === 'in_progress' ? 'bg-yellow-50 border-yellow-300' :
                      batch.status === 'cancelled' ? 'bg-gray-50 border-gray-200 opacity-60' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`font-semibold text-gray-900 ${batch.status === 'cancelled' ? 'line-through' : ''}`}>
                          {batch.name}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          batch.status === 'completed' ? 'bg-green-200 text-green-700' :
                          batch.status === 'in_progress' ? 'bg-yellow-200 text-yellow-700' :
                          batch.status === 'cancelled' ? 'bg-gray-200 text-gray-500' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {batch.status === 'in_progress' ? 'In Progress' : batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 space-y-0.5">
                        {workflow && <div>📋orkflow: {workflow.name}</div>}
                        {batch.scheduled_time && <div>Time: {batch.scheduled_time}</div>}
                        {batch.assigned_to && <div>Assigned to: {batch.assigned_to_name || resolveAssigneeName(batch.assigned_to)}</div>}
                        {batch.batch_size_multiplier !== 1 && <div>Size: {batch.batch_size_multiplier}x</div>}
                        {batch.notes && <div className="italic mt-1">{batch.notes}</div>}
                      </div>
                    </div>

                    {/* Action buttons — context-sensitive based on status */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {batch.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => openEditForm(batch)}
                            className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleStartBatch(batch)}
                            className="px-2.5 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors"
                          >
                            Start
                          </button>
                          <button
                            onClick={() => handleCancelBatch(batch.id)}
                            className="px-2.5 py-1 bg-red-100 text-red-600 rounded text-xs font-medium hover:bg-red-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {batch.status === 'in_progress' && (
                        <span className="text-xs text-yellow-600 font-medium self-center">Running…</span>
                      )}
                      {batch.status === 'completed' && (
                        <span className="text-xs text-green-600 font-medium self-center">✓ Done</span>
                      )}
                      {batch.status === 'cancelled' && (
                        <span className="text-xs text-gray-400 font-medium self-center">Cancelled</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming Scheduled Batches (sorted) ── */}
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Scheduled Batches</h2>
        {upcomingBatches.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-8">No upcoming batches scheduled.</p>
        ) : (
          <div className="space-y-3">
            {upcomingBatches.map(batch => (
              <div key={batch.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">{batch.name}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(batch.scheduled_date + 'T00:00:00').toLocaleDateString()}
                    {batch.scheduled_time && ` at ${batch.scheduled_time}`}
                    {batch.assigned_to && ` • 👤 ${batch.assigned_to_name || resolveAssigneeName(batch.assigned_to)}`}
                    {` • ${batch.batch_size_multiplier}x`}
                  </div>
                  {batch.notes && <div className="text-xs text-gray-500 italic mt-1">{batch.notes}</div>}
                </div>
                <button
                  onClick={() => handleStartBatch(batch)}
                  className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 transition-colors"
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Schedule Batch Modal ── */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setScheduleModalOpen(false)}>
          <div className="bg-white/90 rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Schedule Batch</h3>

            <select
              value={scheduleFormData.workflow_id}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, workflow_id: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Select workflow *</option>
              {workflows.map(wf => (
                <option key={wf.id} value={wf.id}>{wf.name}</option>
              ))}
            </select>

            <select
              value={scheduleFormData.template_id}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, template_id: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Use template (optional)</option>
              {batchTemplates
                .filter(t => t.workflow_id === scheduleFormData.workflow_id)
                .map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
            </select>

            <input
              type="text"
              placeholder="Batch name *"
              value={scheduleFormData.name}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={scheduleFormData.scheduled_date}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduled_date: e.target.value })}
                className="flex-[2] p-3 border border-gray-300 rounded-lg"
              />
              <input
                type="time"
                value={scheduleFormData.scheduled_time}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduled_time: e.target.value })}
                className="flex-1 p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <input
              type="number"
              step="0.1"
              placeholder="Batch size multiplier"
              value={scheduleFormData.batch_size_multiplier || ''}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, batch_size_multiplier: parseFloat(e.target.value) || 1 })}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />

            {/* FIX: Use assignableMembers — always includes "You" */}
            <select
              value={scheduleFormData.assigned_to}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, assigned_to: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Assign to (optional)</option>
              {assignableMembers.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>

            <textarea
              placeholder="Notes"
              value={scheduleFormData.notes}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, notes: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 min-h-[60px]"
            />

            <div className="flex gap-2">
              <button onClick={handleScheduleBatch} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Schedule Batch
              </button>
              <button onClick={() => setScheduleModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}