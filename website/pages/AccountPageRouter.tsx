'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Import your existing premium account page
import PremiumAccountPage from '../components/PremiumAccountPage';

// The new free user account page
import FreeAccountPage from '../components/FreeAccountPage';

export default function AccountPageRouter() {
  const [user, setUser] = useState<any>(null);
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

    setUser(session.user);

    // Check if premium
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const premium = profileData?.role === 'premium' || profileData?.role === 'admin';
    setIsPremium(premium);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  // Show different account pages based on user type
  if (isPremium) {
    return <PremiumAccountPage />;
  } else {
    return <FreeAccountPage />;
  }
}