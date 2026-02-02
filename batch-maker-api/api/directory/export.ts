import type { NextApiRequest, NextApiResponse } from 'next';
import { createAuthenticatedClient, getUserFromRequest, checkSubscription } from '../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    const supabase = createAuthenticatedClient(req);
    
    const hasAccess = await checkSubscription(user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Premium subscription required' });
    }

    // Get all team members with related data
    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select(`
        *,
        member:member_id (
          id,
          email,
          device_name,
          job_title,
          phone,
          hire_date,
          status,
          created_at
        )
      `)
      .eq('business_id', user.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Convert to CSV
    const csv = convertToCSV(teamMembers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="team-directory-${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csv);
    
  } catch (error: any) {
    console.error('Export API error:', error);
    return res.status(401).json({ error: error.message });
  }
}

function convertToCSV(data: any[]): string {
  const headers = ['Email', 'Name', 'Job Title', 'Phone', 'Hire Date', 'Status', 'Added On', 'Role'];
  
  const rows = data.map(item => [
    item.member?.email || '',
    item.member?.device_name || '',
    item.member?.job_title || '',
    item.member?.phone || '',
    item.member?.hire_date || '',
    item.status || '',
    new Date(item.added_at).toLocaleDateString(),
    item.role || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}