// pages/account.tsx
import { useEffect, useState } from 'react';
import PremiumAccountPage from '../components/PremiumAccountPage';
import FreeAccountPage from '../components/FreeAccountPage';
import { getSupabaseClient } from '../lib/supabase';
import { hasDashboardAccess } from '../lib/userTier';

const supabase = getSupabaseClient();

export default function AccountPage() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = '/login';
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, subscription_status, trial_expires_at')
      .eq('id', session.user.id)
      .single();

    setIsPremium(hasDashboardAccess(profile));
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#A8C5B5] rounded-full animate-spin" />
      </div>
    );
  }

  return isPremium ? <PremiumAccountPage /> : <FreeAccountPage />;
}