import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardProps } from '../lib/dashboard-types';

interface Shift {
  id: string;
  owner_id: string;
  assigned_to: string;
  assigned_to_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
  status: 'scheduled' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}

interface TimeEntry {
  id: string;
  owner_id: string;
  user_id: string;
  shift_id: string | null;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
  edited_by: string | null;
  edited_at: string | null;
  edit_reason: string | null;
  created_at: string;
}

export default function DashboardSchedule({ user, networkMembers, isPremium }: DashboardProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [createShiftModalOpen, setCreateShiftModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [shiftFormData, setShiftFormData] = useState({
    assigned_to: '',
    shift_date: '',
    start_time: '09:00',
    end_time: '17:00',
    role: '',
    notes: '',
  });

  const [entryEditData, setEntryEditData] = useState({
    clock_in: '',
    clock_out: '',
    edit_reason: '',
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Fetch data
  useEffect(() => {
    if (!user || !isPremium) return;
    fetchShifts();
    fetchTimeEntries();
  }, [user, isPremium, selectedDate]);

  async function fetchShifts() {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('owner_id', user.id)
      .gte('shift_date', startOfMonth)
      .lte('shift_date', endOfMonth)
      .order('shift_date')
      .order('start_time');

    if (!error && data) setShifts(data);
  }

  async function fetchTimeEntries() {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString();
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('owner_id', user.id)
      .gte('clock_in', startOfMonth)
      .lte('clock_in', endOfMonth)
      .order('clock_in', { ascending: false });

    if (!error && data) setTimeEntries(data);
  }

  // Get assignable members
  const assignableMembers = [
    { id: user.id, label: 'You' },
    ...networkMembers
      .filter(m => m.user_id !== user.id)
      .map(m => ({
        id: m.user_id,
        label: m.profiles?.device_name || m.profiles?.email || 'Unknown',
      })),
  ];

  function resolveUserName(userId: string): string {
    if (userId === user.id) return 'You';
    const member = networkMembers.find(m => m.user_id === userId);
    return member?.profiles?.device_name || member?.profiles?.email || 'Unknown';
  }

  // Calendar helpers
  const getCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(s => s.shift_date === dateStr);
  };

  const getTimeEntriesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return timeEntries.filter(e => e.clock_in.split('T')[0] === dateStr);
  };

  // Create shift
  async function handleCreateShift() {
    if (!shiftFormData.assigned_to || !shiftFormData.shift_date || !shiftFormData.start_time || !shiftFormData.end_time) {
      alert('Please fill in all required fields');
      return;
    }

    const { error } = await supabase.from('shifts').insert({
      owner_id: user.id,
      assigned_to: shiftFormData.assigned_to,
      assigned_to_name: resolveUserName(shiftFormData.assigned_to),
      shift_date: shiftFormData.shift_date,
      start_time: shiftFormData.start_time,
      end_time: shiftFormData.end_time,
      role: shiftFormData.role || null,
      notes: shiftFormData.notes || null,
      status: 'scheduled',
    });

    if (error) {
      alert('Failed to create shift');
      console.error(error);
      return;
    }

    await fetchShifts();
    setCreateShiftModalOpen(false);
    setShiftFormData({ assigned_to: '', shift_date: '', start_time: '09:00', end_time: '17:00', role: '', notes: '' });
  }

  // Cancel shift
  async function handleCancelShift(shiftId: string) {
    const { error } = await supabase
      .from('shifts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', shiftId);

    if (error) {
      alert('Failed to cancel shift');
      return;
    }

    await fetchShifts();
  }

  // Edit time entry
  async function handleEditTimeEntry() {
    if (!editingEntryId || !entryEditData.edit_reason) {
      alert('Edit reason is required');
      return;
    }

    const updates: any = {
      edit_reason: entryEditData.edit_reason,
      edited_by: user.id,
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (entryEditData.clock_in) updates.clock_in = entryEditData.clock_in;
    if (entryEditData.clock_out) updates.clock_out = entryEditData.clock_out;

    const { error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', editingEntryId);

    if (error) {
      alert('Failed to edit time entry');
      return;
    }

    // TODO: Send in-app notification to employee
    console.log('[Schedule] Time entry edited, would send notification');

    await fetchTimeEntries();
    setEditingEntryId(null);
    setEntryEditData({ clock_in: '', clock_out: '', edit_reason: '' });
  }

  const calendarDays = getCalendarDays();
  const dayDetailShifts = selectedDayDate ? getShiftsForDate(selectedDayDate) : [];
  const dayDetailTimeEntries = selectedDayDate ? getTimeEntriesForDate(selectedDayDate) : [];

  if (!isPremium) {
    return (
      <div className="bg-white/90 rounded-xl p-6 shadow-sm text-center">
        <p className="text-gray-500">Schedule management is available for Premium accounts only.</p>
      </div>
    );
  }

  return (
    <>
      {/* Team Member Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {assignableMembers.map(member => {
          const memberShifts = shifts.filter(s => s.assigned_to === member.id && s.status === 'scheduled');
          const memberEntries = timeEntries.filter(e => e.user_id === member.id);
          const totalHours = memberEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
          const isOnline = memberEntries.some(e => !e.clock_out);

          return (
            <div key={member.id} className="bg-white/90 rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="font-semibold text-gray-900">{member.label}</span>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div> {memberShifts.length} upcoming shifts</div>
                <div> {totalHours.toFixed(1)}h this month</div>
                {isOnline && <div className="text-green-600 font-medium">● Clocked In</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shift Calendar */}
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Shift Schedule</h2>
          <button
            onClick={() => setCreateShiftModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            + Create Shift
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
            <div key={day} className="p-2 text-center font-semibold text-xs text-gray-500 uppercase">{day}</div>
          ))}

          {calendarDays.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="aspect-square bg-gray-50 rounded-md"></div>;

            const shiftsOnDay = getShiftsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = selectedDayDate && date.toDateString() === selectedDayDate.toDateString();

            return (
              <div
                key={date.toISOString()}
                onClick={() => setSelectedDayDate(isSelected ? null : date)}
                className={`aspect-square border rounded-md p-1.5 relative overflow-hidden cursor-pointer transition-all ${
                  isSelected ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200' :
                  shiftsOnDay.length > 0 ? 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50' :
                  isToday ? 'bg-sky-50 border-sky-400' : 'bg-white border-gray-200'
                }`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${isToday ? 'text-sky-600' : 'text-gray-700'}`}>
                  {date.getDate()}
                </div>

                {shiftsOnDay.length > 0 && (
                  <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center" style={{ width: '18px', height: '18px', fontSize: '9px', fontWeight: 600 }}>
                    {shiftsOnDay.length}
                  </div>
                )}

                <div className="space-y-0.5">
                  {shiftsOnDay.slice(0, 2).map(shift => (
                    <div
                      key={shift.id}
                      className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis ${
                        shift.status === 'cancelled' ? 'bg-red-100 text-red-500 line-through' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {shift.start_time.slice(0, 5)} {shift.assigned_to_name}
                    </div>
                  ))}
                  {shiftsOnDay.length > 2 && <div className="text-[9px] text-gray-500 italic px-1">+{shiftsOnDay.length - 2}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      {selectedDayDate && (
        <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-sm border border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <button onClick={() => setSelectedDayDate(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>

          {/* Shifts for this day */}
          {dayDetailShifts.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Scheduled Shifts</h3>
              <div className="space-y-2">
                {dayDetailShifts.map(shift => (
                  <div key={shift.id} className={`p-3 rounded-lg border ${shift.status === 'cancelled' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{shift.assigned_to_name}</div>
                        <div className="text-xs text-gray-600">
                          {shift.start_time} - {shift.end_time}
                          {shift.role && ` • ${shift.role}`}
                        </div>
                        {shift.notes && <div className="text-xs text-gray-500 italic mt-1">{shift.notes}</div>}
                      </div>
                      {shift.status === 'scheduled' && (
                        <button onClick={() => handleCancelShift(shift.id)} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-medium hover:bg-red-200">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time entries for this day */}
          {dayDetailTimeEntries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Time Entries</h3>
              <div className="space-y-2">
                {dayDetailTimeEntries.map(entry => {
                  const isEditing = editingEntryId === entry.id;

                  if (isEditing) {
                    return (
                      <div key={entry.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="mb-2 text-xs font-semibold text-gray-700">
                          Editing: {resolveUserName(entry.user_id)}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <input
                            type="datetime-local"
                            value={entryEditData.clock_in}
                            onChange={e => setEntryEditData({ ...entryEditData, clock_in: e.target.value })}
                            className="w-full p-2 text-xs border border-gray-300 rounded-md"
                          />
                          <input
                            type="datetime-local"
                            value={entryEditData.clock_out}
                            onChange={e => setEntryEditData({ ...entryEditData, clock_out: e.target.value })}
                            className="w-full p-2 text-xs border border-gray-300 rounded-md"
                          />
                        </div>

                        <textarea
                          placeholder="Reason for edit (required)"
                          value={entryEditData.edit_reason}
                          onChange={e => setEntryEditData({ ...entryEditData, edit_reason: e.target.value })}
                          className="w-full p-2 text-xs border border-gray-300 rounded-md mb-2 min-h-[50px]"
                        />

                        <div className="flex gap-2">
                          <button onClick={handleEditTimeEntry} className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600">
                            Save
                          </button>
                          <button onClick={() => { setEditingEntryId(null); setEntryEditData({ clock_in: '', clock_out: '', edit_reason: '' }); }} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200">
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={entry.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{resolveUserName(entry.user_id)}</div>
                        <div className="text-xs text-gray-600">
                          In: {new Date(entry.clock_in).toLocaleTimeString()}
                          {entry.clock_out && ` • Out: ${new Date(entry.clock_out).toLocaleTimeString()}`}
                        </div>
                        {entry.total_hours && <div className="text-xs text-gray-600">Total: {entry.total_hours.toFixed(2)}h</div>}
                        {entry.edited_by && (
                          <div className="text-xs text-orange-600 mt-1">
                            Edited — {entry.edit_reason}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingEntryId(entry.id);
                          setEntryEditData({
                            clock_in: entry.clock_in.slice(0, 16),
                            clock_out: entry.clock_out ? entry.clock_out.slice(0, 16) : '',
                            edit_reason: '',
                          });
                        }}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200"
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dayDetailShifts.length === 0 && dayDetailTimeEntries.length === 0 && (
            <p className="text-gray-400 text-sm italic text-center py-6">Nothing scheduled for this day.</p>
          )}
        </div>
      )}

      {/* Create Shift Modal */}
      {createShiftModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCreateShiftModalOpen(false)}>
          <div className="bg-white/90 rounded-xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Create Shift</h3>

            <select value={shiftFormData.assigned_to} onChange={e => setShiftFormData({ ...shiftFormData, assigned_to: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg mb-4">
              <option value="">Select employee *</option>
              {assignableMembers.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>

            <input type="date" value={shiftFormData.shift_date} onChange={e => setShiftFormData({ ...shiftFormData, shift_date: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg mb-4" />

            <div className="flex gap-2 mb-4">
              <input type="time" value={shiftFormData.start_time} onChange={e => setShiftFormData({ ...shiftFormData, start_time: e.target.value })} className="flex-1 p-3 border border-gray-300 rounded-lg" />
              <input type="time" value={shiftFormData.end_time} onChange={e => setShiftFormData({ ...shiftFormData, end_time: e.target.value })} className="flex-1 p-3 border border-gray-300 rounded-lg" />
            </div>

            <input type="text" placeholder="Role (e.g. Production, Packaging)" value={shiftFormData.role} onChange={e => setShiftFormData({ ...shiftFormData, role: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg mb-4" />
            <textarea placeholder="Notes" value={shiftFormData.notes} onChange={e => setShiftFormData({ ...shiftFormData, notes: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg mb-4 min-h-[60px]" />

            <div className="flex gap-2">
              <button onClick={handleCreateShift} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600">Create</button>
              <button onClick={() => setCreateShiftModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}