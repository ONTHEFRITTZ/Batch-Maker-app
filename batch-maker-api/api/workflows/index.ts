// pages/api/workflows/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getUserFromRequest, checkSubscription } from '../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get user from authorization header
    const user = await getUserFromRequest(req);

    // Check subscription
    const hasAccess = await checkSubscription(user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Subscription required' });
    }

    // GET - List workflows
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ workflows: data });
    }

    // POST - Create workflow
    if (req.method === 'POST') {
      const { id, name, steps, claimed_by, claimed_by_name } = req.body;

      if (!id || !name || !steps) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase
        .from('workflows')
        .insert({
          id,
          user_id: user.id,
          name,
          steps,
          claimed_by,
          claimed_by_name,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ workflow: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Workflows API error:', error);
    return res.status(401).json({ error: error.message });
  }
}