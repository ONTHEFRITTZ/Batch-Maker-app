'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    setProfile(profileData);
    setLoading(false);
  }

  async function handleDeleteAccount() {
    if (!user) return;

    setDeleting(true);

    try {
      // Delete user data first
      await supabase.from('workflows').delete().eq('user_id', user.id);
      await supabase.from('batches').delete().eq('user_id', user.id);
      await supabase.from('reports').delete().eq('user_id', user.id);
      await supabase.from('photos').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);

      // Sign out
      await supabase.auth.signOut();
      
      // Redirect to homepage
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again or contact support.');
      setDeleting(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  const isPremium = profile?.role === 'premium' || profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/90 border-b border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
          {isPremium && (
            <Link 
              href="/dashboard"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Account Info */}
        <div className="bg-white/90 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="text-gray-900">{user?.email}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
              <div>
                {isPremium ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium text-sm">
                    Premium Account
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                    Free Account
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
              <div className="text-gray-900">
                {new Date(profile?.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade to Premium */}
        {!isPremium && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 shadow-sm mb-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Upgrade to Premium</h2>
            <p className="text-blue-100 mb-4">
              Unlock team management, shift scheduling, inventory tracking, and advanced workflow features.
            </p>
            <Link
              href="/upgrade"
              className="inline-block px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white/90 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Actions</h2>
          
          <div className="space-y-3">
            <button
              onClick={signOut}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-left"
            >
              Sign Out
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors text-left"
            >
              Delete Account
            </button>
          </div>
        </div>

        {/* Delete Account Warning */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Free accounts only have access to account management. 
            The mobile app requires signing in with Google or Apple to download from the app stores.
            {!isPremium && ' Upgrade to Premium to access the full dashboard and team features.'}
          </p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-white/90 rounded-xl p-8 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete Account?</h3>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                This will permanently delete your account and all associated data:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>All workflows</li>
                <li>All batch history</li>
                <li>All reports</li>
                <li>All photos</li>
                <li>Your profile</li>
              </ul>
              <p className="text-red-600 font-semibold mt-3">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}