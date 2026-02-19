'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '../lib/supabase';
import { hasDashboardAccess, getTierLabel } from '../lib/userTier';

const supabase = getSupabaseClient();

interface TeamMember {
  id: string;
  user_id: string;
  owner_id: string;
  role: 'owner' | 'admin' | 'member';
  require_clock_in: boolean;
  allow_remote_clock_in: boolean;
  allow_anytime_access: boolean;
  profiles?: {
    device_name?: string;
    email?: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface Location {
  id: string;
  user_id: string;
  name: string;
  address: string;
  phone: string;
  manager_name: string;
  operating_hours: string;
  notes: string;
  is_default: boolean;
  created_at: string;
}

export default function DashboardSettings() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const [locationFormData, setLocationFormData] = useState({
    name: '',
    address: '',
    phone: '',
    manager_name: '',
    operating_hours: '',
    notes: '',
    is_default: false,
  });

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
      .select('role, subscription_status, trial_expires_at')
      .eq('id', session.user.id)
      .single();

    setProfile(profileData);

    // Only fetch team data for users with dashboard access
    if (hasDashboardAccess(profileData)) {
      await fetchTeamMembers(session.user.id);
      await fetchInvitations(session.user.id);
    }

    await fetchLocations(session.user.id);
    setLoading(false);
  }

  async function fetchTeamMembers(userId: string) {
    const { data: members, error } = await supabase
      .from('network_member_roles')
      .select('*')
      .eq('owner_id', userId);

    if (error) {
      console.error('Error fetching team members:', error);
      setTeamMembers([]);
      return;
    }

    if (!members || members.length === 0) {
      setTeamMembers([]);
      return;
    }

    const userIds = members.map(m => m.user_id).filter(Boolean);

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, device_name, email')
        .in('id', userIds);

      setTeamMembers(members.map(member => ({
        ...member,
        profiles: profiles?.find(p => p.id === member.user_id),
      })));
    } else {
      setTeamMembers(members);
    }
  }

  async function fetchInvitations(userId: string) {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('business_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) setInvitations(data);
  }

  async function fetchLocations(userId: string) {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('name');

    if (!error && data) setLocations(data);
  }

  async function handleSendInvite() {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setInviting(true);

    try {
      const existingMember = teamMembers.find(
        m => m.profiles?.email?.toLowerCase() === inviteEmail.toLowerCase()
      );
      if (existingMember) {
        alert('This person is already a team member');
        return;
      }

      const existingInvite = invitations.find(
        inv => inv.email.toLowerCase() === inviteEmail.toLowerCase()
      );
      if (existingInvite) {
        alert('An invitation has already been sent to this email');
        return;
      }

      const { error } = await supabase.from('invitations').insert({
        business_id: user.id,
        email: inviteEmail.toLowerCase(),
        role: inviteRole,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      alert(`Invitation sent to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      await fetchInvitations(user.id);
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!confirm('Cancel this invitation?')) return;

    const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
    if (error) { alert('Failed to cancel invitation'); return; }
    await fetchInvitations(user.id);
  }

  async function handleUpdateTeamMember(userId: string, updates: Partial<TeamMember>) {
    const { error } = await supabase
      .from('network_member_roles')
      .update(updates)
      .eq('owner_id', user.id)
      .eq('user_id', userId);

    if (error) { alert('Failed to update team member'); return; }
    await fetchTeamMembers(user.id);
  }

  async function handleRemoveTeamMember(userId: string) {
    if (!confirm('Remove this team member? They will lose access to your workflows.')) return;

    const { error } = await supabase
      .from('network_member_roles')
      .delete()
      .eq('owner_id', user.id)
      .eq('user_id', userId);

    if (error) { alert('Failed to remove team member'); return; }
    await fetchTeamMembers(user.id);
  }

  function openLocationModal(location?: Location) {
    if (location) {
      setEditingLocation(location);
      setLocationFormData({
        name: location.name,
        address: location.address || '',
        phone: location.phone || '',
        manager_name: location.manager_name || '',
        operating_hours: location.operating_hours || '',
        notes: location.notes || '',
        is_default: location.is_default,
      });
    } else {
      setEditingLocation(null);
      setLocationFormData({
        name: '',
        address: '',
        phone: '',
        manager_name: '',
        operating_hours: '',
        notes: '',
        is_default: locations.length === 0,
      });
    }
    setShowLocationModal(true);
  }

  async function handleSaveLocation() {
    if (!locationFormData.name.trim()) {
      alert('Please enter a location name');
      return;
    }

    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('locations')
          .update({ ...locationFormData, updated_at: new Date().toISOString() })
          .eq('id', editingLocation.id);
        if (error) throw error;
        alert('Location updated successfully!');
      } else {
        const { error } = await supabase
          .from('locations')
          .insert({
            user_id: user.id,
            ...locationFormData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
        alert('Location added successfully!');
      }

      setShowLocationModal(false);
      setEditingLocation(null);
      await fetchLocations(user.id);
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location');
    }
  }

  async function handleDeleteLocation(locationId: string) {
    if (!confirm('Delete this location? All associated data will remain but will no longer be linked to this location.')) return;

    const { error } = await supabase.from('locations').delete().eq('id', locationId);
    if (error) { alert('Failed to delete location'); return; }
    await fetchLocations(user.id);
  }

  async function handleSetDefaultLocation(locationId: string) {
    const { error } = await supabase
      .from('locations')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', locationId);

    if (error) { alert('Failed to set default location'); return; }
    await fetchLocations(user.id);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#A8C5B5] rounded-full animate-spin" />
      </div>
    );
  }

  // ── Single source of truth ───────────────────────────────────
  const isPremium = hasDashboardAccess(profile);
  const tierLabel = getTierLabel(profile);

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <header className="glass-card border-b border-gray-200 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Locations Section */}
        <div className="glass-card rounded-xl p-6 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Locations</h2>
            <button
              onClick={() => openLocationModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>➕</span> Add Location
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Manage your business locations. Track inventory, workflows, and analytics separately for each location.
          </p>

          {locations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm italic">No locations added yet.</p>
              <p className="text-gray-500 text-xs mt-2">Add your first location to start tracking by location.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {locations.map(location => (
                <div key={location.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-semibold text-gray-900 text-lg">{location.name}</div>
                        {location.is_default && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {location.address && <div className="flex items-start gap-2"><span className="text-gray-400">📍</span><span>{location.address}</span></div>}
                        {location.phone && <div className="flex items-center gap-2"><span className="text-gray-400">📞</span><span>{location.phone}</span></div>}
                        {location.manager_name && <div className="flex items-center gap-2"><span className="text-gray-400">👤</span><span>Manager: {location.manager_name}</span></div>}
                        {location.operating_hours && <div className="flex items-center gap-2"><span className="text-gray-400">🕐</span><span>{location.operating_hours}</span></div>}
                        {location.notes && (
                          <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-200">
                            <span className="text-gray-400">📝</span>
                            <span className="italic">{location.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {!location.is_default && (
                        <button
                          onClick={() => handleSetDefaultLocation(location.id)}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => openLocationModal(location)}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location.id)}
                        className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Management (premium/trial only) */}
        {isPremium && (
          <>
            <div className="glass-card rounded-xl p-6 shadow-sm mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Team Member Settings</h2>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <span>➕</span> Invite Team Member
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Manage roles and permissions for your team members. Control clock-in requirements and access levels.
              </p>

              {teamMembers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm italic">No team members yet.</p>
                  <p className="text-gray-500 text-xs mt-2">Click "Invite Team Member" to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teamMembers.map(member => (
                    <div key={member.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {member.user_id === user.id
                              ? 'You'
                              : member.profiles?.device_name || member.profiles?.email || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {member.user_id === user.id
                              ? <span className="text-blue-600 font-medium">Account Owner</span>
                              : member.profiles?.email && <span className="text-gray-500">{member.profiles.email}</span>}
                          </div>
                        </div>

                        {member.user_id !== user.id && (
                          <div className="flex items-center gap-2">
                            <select
                              value={member.role}
                              onChange={e => handleUpdateTeamMember(member.user_id, { role: e.target.value as any })}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                              <option value="owner">Owner</option>
                            </select>
                            <button
                              onClick={() => handleRemoveTeamMember(member.user_id)}
                              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      {member.user_id !== user.id && (
                        <>
                          <div className="space-y-2 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={member.require_clock_in}
                                onChange={e => handleUpdateTeamMember(member.user_id, { require_clock_in: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-gray-700">Require clock-in to access workflows</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={member.allow_remote_clock_in}
                                onChange={e => handleUpdateTeamMember(member.user_id, { allow_remote_clock_in: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-gray-700">Allow remote clock-in (bypass location check)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={member.allow_anytime_access}
                                onChange={e => handleUpdateTeamMember(member.user_id, { allow_anytime_access: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-gray-700">Allow anytime access (bypass shift schedule)</span>
                            </label>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 space-y-0.5">
                            <div><strong>Member:</strong> Standard access, requires shifts & clock-in</div>
                            <div><strong>Admin:</strong> Can manage shifts, anytime access</div>
                            <div><strong>Owner:</strong> Full control, can manage all settings</div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div className="glass-card rounded-xl p-6 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Invitations</h3>
                <div className="space-y-3">
                  {invitations.map(invitation => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div>
                        <div className="font-medium text-gray-900">{invitation.email}</div>
                        <div className="text-sm text-gray-600">
                          Role: {invitation.role} · Sent {new Date(invitation.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="px-3 py-1.5 text-sm bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* General Settings */}
        <div className="glass-card rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                isPremium ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {tierLabel}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="text-sm text-gray-600">{user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowLocationModal(false)}
        >
          <div
            className="bg-white rounded-xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            style={{ zIndex: 10000, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-6 text-gray-900">
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location Name *</label>
                <input
                  type="text"
                  value={locationFormData.name}
                  onChange={(e) => setLocationFormData({ ...locationFormData, name: e.target.value })}
                  placeholder="e.g., Downtown Bakery"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={locationFormData.address}
                  onChange={(e) => setLocationFormData({ ...locationFormData, address: e.target.value })}
                  placeholder="123 Main St, City, State 12345"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={locationFormData.phone}
                  onChange={(e) => setLocationFormData({ ...locationFormData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manager / Contact Person</label>
                <input
                  type="text"
                  value={locationFormData.manager_name}
                  onChange={(e) => setLocationFormData({ ...locationFormData, manager_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Operating Hours</label>
                <input
                  type="text"
                  value={locationFormData.operating_hours}
                  onChange={(e) => setLocationFormData({ ...locationFormData, operating_hours: e.target.value })}
                  placeholder="Mon–Fri 6am–6pm"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={locationFormData.notes}
                  onChange={(e) => setLocationFormData({ ...locationFormData, notes: e.target.value })}
                  placeholder="Additional information about this location..."
                  className="w-full p-3 border border-gray-300 rounded-lg min-h-[80px]"
                />
              </div>
              {!editingLocation && locations.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationFormData.is_default}
                    onChange={(e) => setLocationFormData({ ...locationFormData, is_default: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Set as default location</span>
                </label>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveLocation}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {editingLocation ? 'Save Changes' : 'Add Location'}
              </button>
              <button
                onClick={() => setShowLocationModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-xl p-8 max-w-md w-full"
            style={{ zIndex: 10000, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Invite Team Member</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="team@example.com"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                <option value="member">Member — Standard access</option>
                <option value="admin">Admin — Can manage shifts</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                You can change their role and permissions after they accept.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSendInvite}
                disabled={inviting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
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