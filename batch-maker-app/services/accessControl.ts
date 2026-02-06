// ============================================
// FILE: services/accessControl.ts
// Determines what a user can access based on clock-in status
// ============================================

import { supabase } from './supabaseClient';

interface AccessCheck {
  canAccess: boolean;
  reason?: string;
  activeOwnerId?: string; // Which premium network they're clocked into (if any)
}

/**
 * Check if the current user can access workflows from a specific premium owner.
 * 
 * Rules:
 * 1. If user IS the owner → always allow
 * 2. If user has allow_anytime_access → always allow
 * 3. If user does NOT require_clock_in → always allow
 * 4. Otherwise → must be clocked in to that specific network
 */
export async function canAccessWorkflows(userId: string, ownerId: string): Promise<AccessCheck> {
  // Rule 1: You always have access to your own stuff
  if (userId === ownerId) {
    return { canAccess: true, activeOwnerId: userId };
  }

  // Get role settings for this user in this owner's network
  const { data: roleSettings } = await supabase
    .from('network_member_roles')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('user_id', userId)
    .single();

  if (!roleSettings) {
    return { canAccess: false, reason: 'Not a member of this network' };
  }

  // Rule 2: Admins/owners with anytime access
  if (roleSettings.allow_anytime_access) {
    return { canAccess: true, activeOwnerId: ownerId };
  }

  // Rule 3: If clock-in is not required
  if (!roleSettings.require_clock_in) {
    return { canAccess: true, activeOwnerId: ownerId };
  }

  // Rule 4: Must be clocked in to this specific network
  const { data: activeEntry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('owner_id', ownerId)
    .is('clock_out', null)
    .single();

  if (!activeEntry) {
    return { canAccess: false, reason: 'You must clock in to access this network' };
  }

  return { canAccess: true, activeOwnerId: ownerId };
}

/**
 * Get the currently active network for a user (the one they're clocked into).
 * Returns null if not clocked in anywhere.
 */
export async function getActiveNetwork(userId: string): Promise<string | null> {
  const { data: activeEntry } = await supabase
    .from('time_entries')
    .select('owner_id')
    .eq('user_id', userId)
    .is('clock_out', null)
    .single();

  return activeEntry?.owner_id || null;
}

/**
 * Filter a list of workflows to only show those the user can currently access.
 * 
 * When clocked in:
 *   - Show ONLY workflows from the active network (hide personal workflows)
 * When NOT clocked in:
 *   - Show ONLY personal workflows (hide all premium network workflows)
 */
export async function filterAccessibleWorkflows(userId: string, workflows: any[]): Promise<any[]> {
  const activeOwnerId = await getActiveNetwork(userId);

  if (activeOwnerId) {
    // Clocked in → show only workflows from that network
    return workflows.filter(w => w.user_id === activeOwnerId);
  } else {
    // Not clocked in → show only personal workflows
    return workflows.filter(w => w.user_id === userId);
  }
}

/**
 * Same as filterAccessibleWorkflows but for batches.
 */
export async function filterAccessibleBatches(userId: string, batches: any[]): Promise<any[]> {
  const activeOwnerId = await getActiveNetwork(userId);

  if (activeOwnerId) {
    return batches.filter(b => b.user_id === activeOwnerId);
  } else {
    return batches.filter(b => b.user_id === userId);
  }
}

/**
 * Check if a user is allowed to START a batch.
 * Same rules as canAccessWorkflows, but also checks that they're not trying
 * to start a batch from a network they're not clocked into.
 */
export async function canStartBatch(userId: string, workflowOwnerId: string): Promise<AccessCheck> {
  return canAccessWorkflows(userId, workflowOwnerId);
}

/**
 * Get a summary of the user's access status for display in the UI.
 */
export async function getAccessStatus(userId: string): Promise<{
  mode: 'personal' | 'clocked_in';
  activeNetworkId?: string;
  activeNetworkName?: string;
  message: string;
}> {
  const activeOwnerId = await getActiveNetwork(userId);

  if (!activeOwnerId) {
    return {
      mode: 'personal',
      message: 'Personal Mode — Clock in to access team workflows',
    };
  }

  // Get the owner's name
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('device_name, id')
    .eq('id', activeOwnerId)
    .single();

  const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(activeOwnerId);

  const networkName = ownerProfile?.device_name || ownerUser?.email || 'Unknown';

  return {
    mode: 'clocked_in',
    activeNetworkId: activeOwnerId,
    activeNetworkName: networkName,
    message: `Clocked in to ${networkName}`,
  };
}