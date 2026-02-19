'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '../lib/supabase';
import { hasDashboardAccess, getTierLabel } from '../lib/userTier';

const supabase = getSupabaseClient();

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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role, subscription_status, trial_expires_at, created_at')
      .eq('id', session.user.id)
      .single();

    setProfile(profileData);
    setLoading(false);
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);

    try {
      await supabase.from('workflows').delete().eq('user_id', user.id);
      await supabase.from('batches').delete().eq('user_id', user.id);
      await supabase.from('reports').delete().eq('user_id', user.id);
      await supabase.from('photos').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.auth.signOut();
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
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#A8C5B5] rounded-full animate-spin" />
      </div>
    );
  }

  const isPremium = hasDashboardAccess(profile);
  const tierLabel = getTierLabel(profile);

  // Badge colour varies by tier
  const tierBadgeClass = isPremium
    ? 'bg-blue-100 text-blue-700'
    : profile?.subscription_status === 'expired'
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-700';

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
              <span className={`inline-flex items-center px-3 py-1 rounded-full font-medium text-sm ${tierBadgeClass}`}>
                {tierLabel}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
              <div className="text-gray-900">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Expired subscription notice */}
        {profile?.subscription_status === 'expired' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-red-800 mb-1">Your subscription has expired</h2>
            <p className="text-red-700 text-sm mb-4">
              Renew your subscription through the Batch Maker app on iOS or Android to regain full access.
            </p>
          </div>
        )}

        {/* Upgrade prompt — only for genuinely free accounts, not expired */}
        {!isPremium && profile?.subscription_status !== 'expired' && (
          <div className="bg-gradient-to-r from-[#A8C5B5] to-[#8FB5A0] rounded-xl p-6 shadow-sm mb-6 text-white">
            <h2 className="text-xl font-bold mb-2">Get Full Access</h2>
            <p className="text-white/90 text-sm mb-4">
              Download Batch Maker on iOS or Android to start your 30-day free trial and unlock workflows,
              inventory tracking, scheduling, and team management.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-2.5 bg-white text-[#5a8a74] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                App Store
              </a>
              <a
                href="https://play.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-2.5 bg-white text-[#5a8a74] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Google Play
              </a>
            </div>
          </div>
        )}

        {/* Account Actions */}
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

        <p className="mt-4 text-xs text-gray-400 text-center">
          Need help? Contact us at{' '}
          <a href="mailto:batch.maker.app@gmail.com" className="underline hover:text-gray-600">
            batch.maker.app@gmail.com
          </a>
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-xl p-8 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete Account?</h3>

            <p className="text-gray-700 mb-3">
              This will permanently delete your account and all associated data:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
              <li>All workflows</li>
              <li>All batch history</li>
              <li>All reports and photos</li>
              <li>Your profile</li>
            </ul>
            <p className="text-red-600 font-semibold mb-6">This action cannot be undone.</p>

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