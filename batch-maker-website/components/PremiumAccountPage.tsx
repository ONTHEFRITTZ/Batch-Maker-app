'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import DocumentManager from './DocumentManager';

interface BusinessSettings {
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  industry: string;
  tax_id: string;
}

export default function Account() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'business' | 'documents' | 'security'>('profile');
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    industry: '',
    tax_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = '/login';
        return;
      }

      setUser(session.user);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        alert('Failed to load profile data. Please refresh the page.');
        return;
      }

      setProfile(profileData);

      // Load business settings if they exist
      if (profileData?.business_settings) {
        setBusinessSettings(profileData.business_settings);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      alert('Failed to load user data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBusinessSettings() {
    setSaving(true);
    try {
      // First, check if the profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (checkError) {
        console.error('Profile check error:', checkError);
        throw new Error('Could not verify profile. Please try again.');
      }

      // Update the profile with business settings
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          business_settings: businessSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      // Update local state
      setProfile({ ...profile, business_settings: businessSettings });
      alert('Business settings saved successfully!');
      setEditMode(false);
    } catch (error: any) {
      console.error('Error saving business settings:', error);
      
      // More helpful error messages
      if (error.code === '42501') {
        alert('Permission denied. Please check your account permissions.');
      } else if (error.message?.includes('JWT')) {
        alert('Session expired. Please refresh the page and try again.');
      } else {
        alert(`Failed to save business settings: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProfile(field: string, value: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          [field]: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      setProfile({ ...profile, [field]: value });
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(`Failed to update profile: ${error.message || 'Unknown error'}`);
    }
  }

  async function handleChangePassword() {
    const newPassword = prompt('Enter your new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      alert('Password changed successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password');
    }
  }

  async function handleDeleteAccount() {
    if (!confirm('⚠️ WARNING: This will permanently delete your account and ALL data. This cannot be undone. Are you absolutely sure?')) {
      return;
    }

    const confirmation = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmation !== 'DELETE') {
      alert('Account deletion cancelled');
      return;
    }

    try {
      // Delete all user data
      await Promise.all([
        supabase.from('workflows').delete().eq('user_id', user.id),
        supabase.from('batches').delete().eq('user_id', user.id),
        supabase.from('reports').delete().eq('user_id', user.id),
        supabase.from('photos').delete().eq('user_id', user.id),
        supabase.from('team_members').delete().eq('business_id', user.id),
        supabase.from('documents').delete().eq('business_id', user.id),
        supabase.from('invitations').delete().eq('business_id', user.id),
      ]);
      
      // Sign out
      await supabase.auth.signOut();
      window.location.href = '/?deleted=true';
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please contact support.');
    }
  }

  async function handleExportData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch all user data
      const [workflows, batches, reports] = await Promise.all([
        supabase.from('workflows').select('*').eq('user_id', user.id),
        supabase.from('batches').select('*').eq('user_id', user.id),
        supabase.from('reports').select('*').eq('user_id', user.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
        profile: profile,
        workflows: workflows.data || [],
        batches: batches.data || [],
        reports: reports.data || [],
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-maker-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  const isPremium = profile?.role === 'premium' || profile?.role === 'admin';

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>Account Settings</h1>
            <p style={styles.subtitle}>{user?.email}</p>
          </div>
          <Link href="/dashboard" style={styles.backButton}>
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={styles.tabContainer}>
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('profile')}
            style={activeTab === 'profile' ? styles.tabActive : styles.tab}
          >
            Profile
          </button>
          {isPremium && (
            <button
              onClick={() => setActiveTab('business')}
              style={activeTab === 'business' ? styles.tabActive : styles.tab}
            >
              Business
            </button>
          )}
          {isPremium && (
            <button
              onClick={() => setActiveTab('documents')}
              style={activeTab === 'documents' ? styles.tabActive : styles.tab}
            >
              Documents
            </button>
          )}
          <button
            onClick={() => setActiveTab('security')}
            style={activeTab === 'security' ? styles.tabActive : styles.tab}
          >
            Security
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <>
            {/* Account Details */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Account Information</h2>
              
              {/* Primary Email (Locked) */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Primary Email
                  <span style={styles.providerBadge}>
                    {profile?.subscription_platform === 'ios' ? 'Apple Account' : 
                     profile?.subscription_platform === 'android' ? 'Google Account' : 
                     'Account Email'}
                  </span>
                </label>
                <div style={styles.lockedEmailContainer}>
                  <div style={styles.lockedEmail}>{user?.email}</div>
                  <span style={styles.lockIcon}>🔒</span>
                </div>
                <p style={styles.helpText}>
                  This email is connected to your subscription and cannot be changed here.
                </p>
              </div>

              {/* Business Email (Optional) */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Business Email
                  <span style={styles.optionalBadge}>Optional</span>
                </label>
                <input
                  type="email"
                  value={profile?.business_email || ''}
                  onChange={(e) => handleUpdateProfile('business_email', e.target.value)}
                  placeholder="business@example.com"
                  style={styles.input}
                />
                <p style={styles.helpText}>
                  Separate email for business correspondence, invoices, and team notifications.
                </p>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Device Name</label>
                <div style={styles.value}>{profile?.device_name || 'Not set'}</div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Job Title</label>
                <input
                  type="text"
                  value={profile?.job_title || ''}
                  onChange={(e) => handleUpdateProfile('job_title', e.target.value)}
                  placeholder="Your job title"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Phone</label>
                <input
                  type="tel"
                  value={profile?.phone || ''}
                  onChange={(e) => handleUpdateProfile('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Account Created</label>
                <div style={styles.value}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Subscription</h2>
              
              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <div style={styles.value}>
                  <span style={{
                    ...styles.badge,
                    backgroundColor: profile?.subscription_status === 'active' ? '#10b981' : '#6b7280'
                  }}>
                    {profile?.subscription_status || 'Free'}
                  </span>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Role</label>
                <div style={styles.value}>
                  <span style={styles.badge}>
                    {profile?.role || 'user'}
                  </span>
                </div>
              </div>

              {!isPremium && (
                <div style={styles.upgradePrompt}>
                  <p>Upgrade to Premium to access team management, document tools, and more!</p>
                  <Link href="/pricing" style={styles.upgradeButton}>
                    Upgrade Now
                  </Link>
                </div>
              )}
            </div>

            {/* Data Export */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Data Export</h2>
              <p style={styles.cardText}>
                Download a copy of all your data including workflows, batches, and reports.
              </p>
              <button onClick={handleExportData} style={styles.primaryButton}>
                Export My Data (JSON)
              </button>
            </div>
          </>
        )}

        {/* Business Tab */}
        {activeTab === 'business' && isPremium && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Business Information</h2>
              <button
                onClick={() => setEditMode(!editMode)}
                style={styles.smallButton}
              >
                {editMode ? 'Cancel' : 'Edit'}
              </button>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Business Name</label>
              <input
                type="text"
                value={businessSettings.business_name}
                onChange={(e) => setBusinessSettings({...businessSettings, business_name: e.target.value})}
                disabled={!editMode}
                placeholder="Your Business LLC"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Business Email</label>
              <input
                type="email"
                value={businessSettings.business_email}
                onChange={(e) => setBusinessSettings({...businessSettings, business_email: e.target.value})}
                disabled={!editMode}
                placeholder="contact@business.com"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Business Phone</label>
              <input
                type="tel"
                value={businessSettings.business_phone}
                onChange={(e) => setBusinessSettings({...businessSettings, business_phone: e.target.value})}
                disabled={!editMode}
                placeholder="+1 (555) 123-4567"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Business Address</label>
              <textarea
                value={businessSettings.business_address}
                onChange={(e) => setBusinessSettings({...businessSettings, business_address: e.target.value})}
                disabled={!editMode}
                placeholder="123 Main St, City, State 12345"
                rows={3}
                style={styles.textarea}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Industry</label>
              <select
                value={businessSettings.industry}
                onChange={(e) => setBusinessSettings({...businessSettings, industry: e.target.value})}
                disabled={!editMode}
                style={styles.input}
              >
                <option value="">Select industry</option>
                <option value="bakery">Bakery</option>
                <option value="restaurant">Restaurant</option>
                <option value="catering">Catering</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="food-production">Food Production</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Tax ID / EIN (Optional)</label>
              <input
                type="text"
                value={businessSettings.tax_id}
                onChange={(e) => setBusinessSettings({...businessSettings, tax_id: e.target.value})}
                disabled={!editMode}
                placeholder="12-3456789"
                style={styles.input}
              />
            </div>

            {editMode && (
              <button
                onClick={handleSaveBusinessSettings}
                disabled={saving}
                style={styles.primaryButton}
              >
                {saving ? 'Saving...' : 'Save Business Settings'}
              </button>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && isPremium && (
          <div>
            <div style={styles.infoBox}>
              <h3 style={styles.infoTitle}>Document Management</h3>
              <p style={styles.infoText}>
                Upload document templates that can be automatically sent to new team members 
                during onboarding (W-4, I-9, NDAs, training materials, etc.)
              </p>
            </div>
            <DocumentManager isAdmin={true} />
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Password & Authentication</h2>
              
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <div style={styles.fieldRow}>
                  <div style={styles.value}>••••••••</div>
                  <button onClick={handleChangePassword} style={styles.smallButton}>
                    Change Password
                  </button>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Two-Factor Authentication</label>
                <div style={styles.value}>
                  <span style={{...styles.badge, backgroundColor: '#6b7280'}}>
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div style={styles.dangerCard}>
              <h2 style={styles.dangerTitle}>Danger Zone</h2>
              
              <div style={styles.dangerSection}>
                <div>
                  <h3 style={styles.dangerSubtitle}>Delete Account</h3>
                  <p style={styles.dangerText}>
                    Permanently delete your account and all associated data including:
                  </p>
                  <ul style={styles.dangerList}>
                    <li>All workflows and recipes</li>
                    <li>All batch tracking data</li>
                    <li>All reports and photos</li>
                    <li>Team members and invitations</li>
                    <li>Business documents</li>
                  </ul>
                  <p style={styles.dangerWarning}>
                    ⚠️ This action cannot be undone. All data will be permanently deleted.
                  </p>
                </div>
                <button onClick={handleDeleteAccount} style={styles.deleteButton}>
                  Delete Account
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '1.5rem 0',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    margin: 0,
    color: '#111827',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  backButton: {
    padding: '0.625rem 1.25rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    textDecoration: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  tabContainer: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
  },
  tabs: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem',
    display: 'flex',
    gap: '0.5rem',
  },
  tab: {
    padding: '1rem 1.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#6b7280',
    transition: 'all 0.2s',
  },
  tabActive: {
    padding: '1rem 1.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid #3b82f6',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#3b82f6',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    fontSize: '1.125rem',
    color: '#6b7280',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '0.75rem',
    padding: '2rem',
    marginBottom: '1.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
    color: '#111827',
  },
  cardText: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '1rem',
    lineHeight: '1.5',
  },
  field: {
    marginBottom: '1.5rem',
  },
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  providerBadge: {
    fontSize: '0.75rem',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '0.375rem',
    fontWeight: '600',
  },
  optionalBadge: {
    fontSize: '0.75rem',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    borderRadius: '0.375rem',
    fontWeight: '500',
  },
  lockedEmailContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
  },
  lockedEmail: {
    flex: 1,
    fontSize: '1rem',
    color: '#6b7280',
  },
  lockIcon: {
    fontSize: '1.125rem',
    marginLeft: '0.5rem',
  },
  helpText: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.375rem',
    lineHeight: '1.25',
  },
  value: {
    fontSize: '1rem',
    color: '#111827',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textarea: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    color: '#111827',
    backgroundColor: '#ffffff',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  badge: {
    display: 'inline-block',
    padding: '0.375rem 0.875rem',
    backgroundColor: '#10b981',
    color: '#ffffff',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    textTransform: 'capitalize' as const,
  },
  smallButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  primaryButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    width: '100%',
  },
  upgradePrompt: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#eff6ff',
    borderRadius: '0.5rem',
    border: '1px solid #bfdbfe',
  },
  upgradeButton: {
    display: 'inline-block',
    marginTop: '0.75rem',
    padding: '0.625rem 1.25rem',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  infoTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: '0.5rem',
  },
  infoText: {
    fontSize: '0.875rem',
    color: '#1e40af',
    lineHeight: '1.5',
    margin: 0,
  },
  dangerCard: {
    backgroundColor: '#ffffff',
    borderRadius: '0.75rem',
    padding: '2rem',
    border: '2px solid #ef4444',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  dangerTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#dc2626',
  },
  dangerSection: {
    marginTop: '1rem',
  },
  dangerSubtitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: '0.5rem',
  },
  dangerText: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '0.75rem',
    lineHeight: '1.5',
  },
  dangerList: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginLeft: '1.5rem',
    marginBottom: '1rem',
    lineHeight: '1.75',
  },
  dangerWarning: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: '1rem',
  },
  deleteButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};