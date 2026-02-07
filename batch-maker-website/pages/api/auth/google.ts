import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '../../../lib/supabase';

const supabase = getSupabaseClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redirectUrl = `${req.headers.origin}/api/auth/callback`;
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ url: data.url });
  } catch (error: any) {
    console.error('Google auth error:', error);
    return res.status(500).json({ error: error.message });
  }
}