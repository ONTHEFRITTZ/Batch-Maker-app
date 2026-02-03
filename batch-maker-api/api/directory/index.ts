import type { NextApiRequest, NextApiResponse } from 'next';
import { createAuthenticatedClient, getUserFromRequest, checkSubscription } from '../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const user = await getUserFromRequest(req);
    const authToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const supabase = createAuthenticatedClient(authToken);
    
    const hasAccess = await checkSubscription(user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Premium subscription required' });
    }

    // GET - List team members
    if (req.method === 'GET') {
      const { data: teamMembers, error } = await supabase
        .from('team_members')
        .select(`
          *,
          member:member_id (
            id,
            email,
            device_name,
            role,
            status,
            job_title,
            phone,
            hire_date,
            created_at
          )
        `)
        .eq('business_id', user.id)
        .order('added_at', { ascending: false });

      if (error) {
        console.error('Team members fetch error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ teamMembers });
    }

    // POST - Add team member (after they accept invite)
    if (req.method === 'POST') {
      const { member_id, role } = req.body;

      if (!member_id) {
        return res.status(400).json({ error: 'Member ID required' });
      }

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          business_id: user.id,
          member_id,
          role: role || 'employee',
          added_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Team member creation error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ teamMember: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error: any) {
    console.error('Directory API error:', error);
    return res.status(401).json({ error: error.message });
  }
}