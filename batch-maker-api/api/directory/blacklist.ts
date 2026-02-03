import type { NextApiRequest, NextApiResponse } from 'next';
import { createAuthenticatedClient, getUserFromRequest, checkSubscription } from '../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    const authToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const supabase = createAuthenticatedClient(authToken);
    
    const hasAccess = await checkSubscription(user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Premium subscription required' });
    }

    const { member_id, action, reason } = req.body; // action: 'blacklist' or 'activate'

    if (!member_id || !action) {
      return res.status(400).json({ error: 'Member ID and action required' });
    }

    const newStatus = action === 'blacklist' ? 'blacklisted' : 'active';
    const updates: any = { status: newStatus };

    if (action === 'blacklist') {
      updates.terminated_at = new Date().toISOString();
      updates.termination_reason = reason || 'Not specified';
    }

    const { error } = await supabase
      .from('team_members')
      .update(updates)
      .eq('business_id', user.id)
      .eq('member_id', member_id);

    if (error) {
      console.error('Blacklist error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Also update profile status
    await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', member_id);

    return res.status(200).json({ 
      message: `User ${action === 'blacklist' ? 'blacklisted' : 'reactivated'} successfully` 
    });
    
  } catch (error: any) {
    console.error('Blacklist API error:', error);
    return res.status(401).json({ error: error.message });
  }
}