// ============================================
// FILE: api/timeEntries.ts
// Backend routes for time tracking
// ============================================

import { supabase } from '../../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getAuthUser(req: any): Promise<any> {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) throw new ApiError(401, 'Missing authorization token');
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid or expired token');
  return user;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function wrapHandler(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error(`[timeEntries] ${status}:`, message);
      res.status(status).json({ error: message });
    }
  };
}

// Helper: check if a user can clock in to a specific network
async function canClockIn(userId: string, ownerId: string): Promise<{ allowed: boolean; reason?: string; shift?: any }> {
  // Get the user's role settings
  const { data: roleSettings } = await supabase
    .from('network_member_roles')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('user_id', userId)
    .single();

  if (!roleSettings) {
    return { allowed: false, reason: 'Not a member of this network' };
  }

  // Owner and admins with allow_anytime_access can clock in anytime
  if (roleSettings.allow_anytime_access) {
    return { allowed: true };
  }

  // If require_clock_in is false, they can access without clocking in
  if (!roleSettings.require_clock_in) {
    return { allowed: true };
  }

  // Check if there's an upcoming shift within the next 30 minutes
  const now = new Date();
  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
  const today = now.toISOString().split('T')[0];

  const { data: upcomingShifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('assigned_to', userId)
    .eq('shift_date', today)
    .eq('status', 'scheduled');

  if (!upcomingShifts || upcomingShifts.length === 0) {
    return { allowed: false, reason: 'No scheduled shift today' };
  }

  // Check if any shift is within the 30-minute window
  for (const shift of upcomingShifts) {
    const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}`);
    if (now <= shiftStart && shiftStart <= thirtyMinutesFromNow) {
      return { allowed: true, shift };
    }
    // Also allow if shift has already started and not yet ended
    const shiftEnd = new Date(`${shift.shift_date}T${shift.end_time}`);
    if (now >= shiftStart && now <= shiftEnd) {
      return { allowed: true, shift };
    }
  }

  return { allowed: false, reason: 'No shift starting within 30 minutes' };
}

// ─── POST /api/time-entries/clock-in ──────────────────────────────────────
// Clock in to a specific network

export const clockIn = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  const { owner_id, location } = req.body || {};

  if (!owner_id) {
    throw new ApiError(400, 'owner_id is required');
  }

  // Check if already clocked in somewhere
  const { data: activeEntry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .is('clock_out', null)
    .single();

  if (activeEntry) {
    throw new ApiError(409, 'Already clocked in. Clock out first.');
  }

  // Check if user can clock in
  const check = await canClockIn(user.id, owner_id);
  if (!check.allowed) {
    throw new ApiError(403, check.reason || 'Not authorized to clock in');
  }

  const { data: timeEntry, error } = await supabase
    .from('time_entries')
    .insert({
      owner_id,
      user_id: user.id,
      shift_id: check.shift?.id || null,
      clock_in: new Date().toISOString(),
      clock_in_location: location || null,
    })
    .select()
    .single();

  if (error || !timeEntry) {
    throw new ApiError(500, 'Failed to clock in');
  }

  res.status(201).json(timeEntry);
});

// ─── POST /api/time-entries/clock-out ─────────────────────────────────────
// Clock out from current active session

export const clockOut = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  const { location } = req.body || {};

  // Find active time entry
  const { data: activeEntry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .is('clock_out', null)
    .single();

  if (!activeEntry) {
    throw new ApiError(404, 'No active clock-in found');
  }

  const { data: timeEntry, error } = await supabase
    .from('time_entries')
    .update({
      clock_out: new Date().toISOString(),
      clock_out_location: location || null,
    })
    .eq('id', activeEntry.id)
    .select()
    .single();

  if (error || !timeEntry) {
    throw new ApiError(500, 'Failed to clock out');
  }

  res.status(200).json(timeEntry);
});

// ─── GET /api/time-entries/active ─────────────────────────────────────────
// Get current user's active clock-in session

export const getActiveEntry = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);

  const { data: activeEntry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .is('clock_out', null)
    .single();

  res.status(200).json(activeEntry || null);
});

// ─── GET /api/time-entries ────────────────────────────────────────────────
// Get time entries (owner sees all for their network, user sees their own)

export const getTimeEntries = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  const { start_date, end_date, user_id } = req.query;

  let query = supabase
    .from('time_entries')
    .select('*')
    .order('clock_in', { ascending: false });

  // If querying as owner
  if (user_id && user_id !== user.id) {
    query = query.eq('owner_id', user.id).eq('user_id', user_id);
  } else {
    // Default: show entries where you're the owner OR the employee
    query = query.or(`owner_id.eq.${user.id},user_id.eq.${user.id}`);
  }

  if (start_date) query = query.gte('clock_in', start_date);
  if (end_date) query = query.lte('clock_in', end_date);

  const { data: entries, error } = await query;

  if (error) {
    throw new ApiError(500, 'Failed to fetch time entries');
  }

  res.status(200).json(entries || []);
});

// ─── PATCH /api/time-entries/:id ──────────────────────────────────────────
// Edit a time entry (owner/admin only) — sends email notification to employee

export const editTimeEntry = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  const { id } = req.params;
  const { clock_in, clock_out, edit_reason } = req.body || {};

  if (!id) throw new ApiError(400, 'Time entry ID required');
  if (!edit_reason) throw new ApiError(400, 'edit_reason is required');

  // Fetch the entry and verify ownership
  const { data: entry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', id)
    .single();

  if (!entry || entry.owner_id !== user.id) {
    throw new ApiError(403, 'Not authorized to edit this entry');
  }

  const updates: any = {
    edited_by: user.id,
    edited_at: new Date().toISOString(),
    edit_reason,
    updated_at: new Date().toISOString(),
  };

  if (clock_in) updates.clock_in = clock_in;
  if (clock_out) updates.clock_out = clock_out;

  const { data: updated, error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    throw new ApiError(500, 'Failed to update time entry');
  }

  // ── Send email notification to the employee ──────────────────────────
  // Replace with your actual email service (Resend, SendGrid, etc.)
  const { data: employeeProfile } = await supabase
    .from('profiles')
    .select('id, device_name')
    .eq('id', entry.user_id)
    .single();

  const { data: { user: employeeUser } } = await supabase.auth.admin.getUserById(entry.user_id);

  if (employeeUser?.email) {
    const emailBody = `
      Your time entry has been modified by management.
      
      Original Clock In: ${new Date(entry.clock_in).toLocaleString()}
      ${entry.clock_out ? `Original Clock Out: ${new Date(entry.clock_out).toLocaleString()}` : ''}
      
      ${clock_in ? `New Clock In: ${new Date(clock_in).toLocaleString()}` : ''}
      ${clock_out ? `New Clock Out: ${new Date(clock_out).toLocaleString()}` : ''}
      
      Reason: ${edit_reason}
      
      Total Hours: ${updated.total_hours || 'N/A'}
    `;

    console.log(`[timeEntries] Would send email to ${employeeUser.email}:`);
    console.log(emailBody);

    // Example with Resend:
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'noreply@yourdomain.com',
    //   to: employeeUser.email,
    //   subject: 'Your time entry was modified',
    //   text: emailBody,
    // });
  }

  res.status(200).json(updated);
});

// ─── GET /api/time-entries/check-shift-alert ──────────────────────────────
// Check if user is still clocked in >30min after shift end (for alerts)

export const checkShiftAlert = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);

  const { data: activeEntry } = await supabase
    .from('time_entries')
    .select('*, shifts(*)')
    .eq('user_id', user.id)
    .is('clock_out', null)
    .single();

  if (!activeEntry || !activeEntry.shifts) {
    res.status(200).json({ alert: false });
    return;
  }

  const shift = activeEntry.shifts;
  const shiftEnd = new Date(`${shift.shift_date}T${shift.end_time}`);
  const now = new Date();
  const thirtyMinutesAfterShift = new Date(shiftEnd.getTime() + 30 * 60 * 1000);

  if (now > thirtyMinutesAfterShift) {
    res.status(200).json({
      alert: true,
      message: 'Your shift ended over 30 minutes ago. Are you still working?',
      shift_end: shiftEnd.toISOString(),
    });
  } else {
    res.status(200).json({ alert: false });
  }
});