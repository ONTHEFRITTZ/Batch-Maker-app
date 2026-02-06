import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

interface TeamMember {
  id: string;
  business_id: string;
  member_id: string;
  role: string;
  status: string;
  added_at: string;
  terminated_at?: string;
  termination_reason?: string;
  member: {
    id: string;
    email: string;
    device_name: string;
    job_title?: string;
    phone?: string;
    hire_date?: string;
    status: string;
    created_at: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  status: string;
  invited_at: string;
  expires_at: string;
}

export default function Directory() {
  const [user, setUser] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'blacklisted'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    job_title: '',
    phone: '',
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
    await fetchTeamMembers(session.access_token);
    await fetchInvitations(session.access_token);
    setLoading(false);
  }

  async function fetchTeamMembers(token: string) {
    try {
      const response = await fetch('/api/directory', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch team members');

      const data = await response.json();
      setTeamMembers(data.teamMembers || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }

  async function fetchInvitations(token: string) {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('business_id', user?.id)
        .order('invited_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  }

  async function handleSendInvite() {
    if (!inviteForm.email) {
      alert('Email is required');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/directory/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteForm),
      });

      if (!response.ok) throw new Error('Failed to send invitation');

      const data = await response.json();
      alert(`Invitation sent to ${inviteForm.email}!`);
      
      setShowInviteModal(false);
      setInviteForm({
        email: '',
        first_name: '',
        last_name: '',
        job_title: '',
        phone: '',
      });

      await fetchInvitations(session.access_token);
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to send invitation');
    }
  }

  async function handleBlacklist(memberId: string, currentStatus: string) {
    const action = currentStatus === 'blacklisted' ? 'activate' : 'blacklist';
    const confirmMsg = action === 'blacklist' 
      ? 'Are you sure you want to blacklist this user? They will lose access to workflows.'
      : 'Reactivate this user?';

    if (!confirm(confirmMsg)) return;

    const reason = action === 'blacklist' 
      ? prompt('Reason for blacklisting (optional):')
      : null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/directory/blacklist', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ member_id: memberId, action, reason }),
      });

      if (!response.ok) throw new Error('Failed to update user status');

      alert(action === 'blacklist' ? 'User blacklisted' : 'User reactivated');
      await fetchTeamMembers(session.access_token);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status');
    }
  }

  async function handleExport() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/directory/export', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-directory-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Failed to export directory');
    }
  }

  // Filter and search
  const filteredMembers = teamMembers.filter(member => {
    const matchesFilter = filter === 'all' || member.status === filter;
    const matchesSearch = !searchQuery || 
      member.member?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.member?.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.member?.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Directory</h1>
            <p className="text-gray-500 mt-1">Manage your employees and contractors</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              📊 Export CSV
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Invite User
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({teamMembers.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'active' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active ({teamMembers.filter(m => m.status === 'active').length})
            </button>
            <button
              onClick={() => setFilter('blacklisted')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'blacklisted' 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Blacklisted ({teamMembers.filter(m => m.status === 'blacklisted').length})
            </button>
          </div>

          <div className="flex-1 min-w-[300px]">
            <input
              type="text"
              placeholder="Search by name, email, or job title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.filter(i => i.status === 'pending').length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-yellow-900 mb-4">
              📨 Pending Invitations ({invitations.filter(i => i.status === 'pending').length})
            </h2>
            <div className="space-y-3">
              {invitations.filter(i => i.status === 'pending').map(invite => (
                <div key={invite.id} className="bg-white rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">
                      {invite.first_name} {invite.last_name}
                    </div>
                    <div className="text-sm text-gray-600">{invite.email}</div>
                    {invite.job_title && (
                      <div className="text-sm text-gray-500">{invite.job_title}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      Sent {new Date(invite.invited_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-yellow-600">
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Members List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg mb-2">No team members found</p>
              <p className="text-sm">Start by inviting your first team member</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMembers.map(member => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                            member.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            {member.member?.device_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.member?.device_name || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {member.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.member?.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {member.member?.job_title || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {member.member?.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {member.status === 'active' ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            ✓ Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            ✕ Blacklisted
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(member.added_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => handleBlacklist(member.member_id, member.status)}
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            member.status === 'active'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {member.status === 'active' ? 'Blacklist' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div 
            className="bg-white rounded-xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Invite Team Member</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.first_name}
                    onChange={(e) => setInviteForm({...inviteForm, first_name: e.target.value})}
                    placeholder="John"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm({...inviteForm, last_name: e.target.value})}
                    placeholder="Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={inviteForm.job_title}
                  onChange={(e) => setInviteForm({...inviteForm, job_title: e.target.value})}
                  placeholder="Baker"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({...inviteForm, phone: e.target.value})}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}