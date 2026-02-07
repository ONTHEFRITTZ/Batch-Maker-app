// ============================================
// FILE: api/shifts.ts
// Backend routes for shift scheduling
// ============================================

import { getSupabaseClient } from '../../lib/supabase';

const supabase = getSupabaseClient();

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
      console.error(`[shifts] ${status}:`, message);
      res.status(status).json({ error: message });
    }
  };
}

// ─── POST /api/shifts ─────────────────────────────────────────────────────
// Create a new shift (owner/admin only)

export const createShift = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  
  const { assigned_to, shift_date, start_time, end_time, role, notes } = req.body || {};
  
  if (!assigned_to || !shift_date || !start_time || !end_time) {
    throw new ApiError(400, 'assigned_to, shift_date, start_time, and end_time are required');
  }

  // Verify the assigned user is in the owner's network
  const { data: member } = await supabase
    .from('networks')
    .select('*, profiles!inner(device_name, email)')
    .eq('owner_id', user.id)
    .eq('user_id', assigned_to)
    .single();

  if (!member) {
    throw new ApiError(404, 'User not found in your network');
  }

  const assigned_to_name = member.profiles?.device_name || member.profiles?.email || 'Unknown';

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      owner_id: user.id,
      assigned_to,
      assigned_to_name,
      shift_date,
      start_time,
      end_time,
      role,
      notes,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error || !shift) {
    throw new ApiError(500, 'Failed to create shift');
  }

  res.status(201).json(shift);
});

// ─── GET /api/shifts ──────────────────────────────────────────────────────
// Get shifts for the current user (as owner or as assigned employee)

export const getShifts = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  const { start_date, end_date, status } = req.query;

  // Build query: show shifts where user is owner OR assigned_to
  let query = supabase
    .from('shifts')
    .select('*')
    .or(`owner_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (start_date) query = query.gte('shift_date', start_date);
  if (end_date) query = query.lte('shift_date', end_date);
  if (status) query = query.eq('status', status);

  const { data: shifts, error } = await query;

  if (error) {
    throw new ApiError(500, 'Failed to fetch shifts');
  }

  res.status(200).json(shifts || []);
});

// ─── PATCH /api/shifts/:id ────────────────────────────────────────────────
// Update a shift (owner/admin only)

export const updateShift = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  const { id } = req.params;

  if (!id) throw new ApiError(400, 'Shift ID required');

  // Verify ownership
  const { data: existing } = await supabase
    .from('shifts')
    .select('owner_id')
    .eq('id', id)
    .single();

  if (!existing || existing.owner_id !== user.id) {
    throw new ApiError(403, 'Not authorized to update this shift');
  }

  const { assigned_to, shift_date, start_time, end_time, role, notes, status } = req.body || {};

  const updates: any = { updated_at: new Date().toISOString() };
  if (assigned_to !== undefined) {
    updates.assigned_to = assigned_to;
    // Re-resolve name
    const { data: member } = await supabase
      .from('networks')
      .select('*, profiles!inner(device_name, email)')
      .eq('owner_id', user.id)
      .eq('user_id', assigned_to)
      .single();
    updates.assigned_to_name = member?.profiles?.device_name || member?.profiles?.email || 'Unknown';
  }
  if (shift_date !== undefined) updates.shift_date = shift_date;
  if (start_time !== undefined) updates.start_time = start_time;
  if (end_time !== undefined) updates.end_time = end_time;
  if (role !== undefined) updates.role = role;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;

  const { data: shift, error } = await supabase
    .from('shifts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !shift) {
    throw new ApiError(500, 'Failed to update shift');
  }

  res.status(200).json(shift);
});

// ─── DELETE /api/shifts/:id ───────────────────────────────────────────────
// Cancel a shift (owner/admin only)

export const deleteShift = wrapHandler(async (req: any, res: any) => {
  const user = await getAuthUser(req);
  const { id } = req.params;

  if (!id) throw new ApiError(400, 'Shift ID required');

  // Verify ownership
  const { data: existing } = await supabase
    .from('shifts')
    .select('owner_id')
    .eq('id', id)
    .single();

  if (!existing || existing.owner_id !== user.id) {
    throw new ApiError(403, 'Not authorized to delete this shift');
  }

  // Soft delete by marking cancelled
  const { error } = await supabase
    .from('shifts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new ApiError(500, 'Failed to cancel shift');
  }

  res.status(200).json({ success: true });
});