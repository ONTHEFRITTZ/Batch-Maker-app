// batch-maker-api/api/workflows/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin, getUserFromRequest } from '../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authenticated user from request
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { workflowId } = req.body;

    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }

    // First, verify the workflow belongs to this user
    const { data: workflow, error: fetchError } = await supabaseAdmin
      .from('workflows')
      .select('user_id')
      .eq('id', workflowId)
      .single();

    if (fetchError || !workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.user_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this workflow' });
    }

    // Option 1: Soft delete (recommended)
    const { error: updateError } = await supabaseAdmin
      .from('workflows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', workflowId);

    if (updateError) {
      console.error('Error soft-deleting workflow:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // Option 2: Hard delete (uncomment if you prefer this)
    // const { error: deleteError } = await supabaseAdmin
    //   .from('workflows')
    //   .delete()
    //   .eq('id', workflowId);
    //
    // if (deleteError) {
    //   console.error('Error deleting workflow:', deleteError);
    //   return res.status(500).json({ error: deleteError.message });
    // }

    return res.status(200).json({ 
      success: true, 
      message: 'Workflow deleted successfully' 
    });
  } catch (error: any) {
    console.error('Delete workflow error:', error);
    return res.status(500).json({ error: error.message });
  }
}