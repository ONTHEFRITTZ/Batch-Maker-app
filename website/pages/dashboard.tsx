import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import Link from "next/link"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [workflows, setWorkflows] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [network, setNetwork] = useState<any>(null)
  const [networkMembers, setNetworkMembers] = useState<any[]>([])
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [inviteEmail, setInviteEmail] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)
      await fetchAllData(session.user.id)
      setLoading(false)
    }

    checkAuth()
  }, [router])

  const fetchAllData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      setProfile(profileData)

      // Fetch user's network if they're premium
      if (profileData?.role === 'premium' || profileData?.role === 'admin') {
        const { data: networkData } = await supabase
          .from('networks')
          .select('*')
          .eq('owner_id', userId)
          .single()
        
        setNetwork(networkData)

        if (networkData) {
          // Fetch network members
          const { data: membersData } = await supabase
            .from('network_members')
            .select(`
              *,
              profiles:user_id (
                id,
                email,
                device_name
              )
            `)
            .eq('network_id', networkData.id)
          
          setNetworkMembers(membersData || [])
        }
      }

      // Fetch workflows
      const { data: workflowsData } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      
      setWorkflows(workflowsData || [])

      // Fetch batches
      const { data: batchesData } = await supabase
        .from('batches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      setBatches(batchesData || [])

      // Fetch reports
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      
      setReports(reportsData || [])

      // Fetch photos
      const { data: photosData } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      
      setPhotos(photosData || [])

    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const openAssignModal = (workflow: any) => {
    setSelectedWorkflow(workflow)
    setAssignModalOpen(true)
  }

  const handleAssignWorkflow = async (targetUserId: string) => {
    try {
      const targetMember = networkMembers.find(m => m.user_id === targetUserId)
      
      const { error } = await supabase
        .from('workflows')
        .update({
          claimed_by: targetUserId,
          claimed_by_name: targetMember?.profiles?.device_name || targetMember?.profiles?.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedWorkflow.id)

      if (!error) {
        await fetchAllData(user.id)
        setAssignModalOpen(false)
        alert('Workflow assigned successfully!')
      } else {
        alert('Error assigning workflow: ' + error.message)
      }
    } catch (error) {
      console.error('Error assigning workflow:', error)
      alert('Error assigning workflow')
    }
  }

  const handleInviteUser = async () => {
    if (!inviteEmail || !network) return

    try {
      // In a real app, you'd send an email invitation
      // For now, we'll just show a message
      alert(`Invitation sent to ${inviteEmail}! They'll need to sign in and join your network.`)
      setInviteEmail('')
      setInviteModalOpen(false)
    } catch (error) {
      console.error('Error inviting user:', error)
      alert('Error sending invitation')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const { error } = await supabase
        .from('network_members')
        .delete()
        .eq('id', memberId)

      if (!error) {
        await fetchAllData(user.id)
        alert('Member removed successfully')
      } else {
        alert('Error removing member: ' + error.message)
      }
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Error removing member')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const isPremium = profile?.role === 'premium' || profile?.role === 'admin'
  const activeBatches = batches.filter(b => b.current_step_index < (b.steps?.length || 0))

  return (
    <main className="min-h-screen px-6 py-12 bg-bakery-bg">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-sm text-bakery-muted mt-1">
              {isPremium ? '👑 Premium Account' : '🆓 Free Account'}
            </p>
          </div>

          <nav className="flex gap-4 text-sm">
            <Link href="/account" className="underline">
              Account
            </Link>
            <button onClick={handleSignOut} className="underline">
              Sign Out
            </button>
          </nav>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-soft">
            <div className="text-2xl font-bold text-bakery-accent">{workflows.length}</div>
            <div className="text-sm text-bakery-muted">Total Workflows</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-soft">
            <div className="text-2xl font-bold text-bakery-accent">{activeBatches.length}</div>
            <div className="text-sm text-bakery-muted">Active Batches</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-soft">
            <div className="text-2xl font-bold text-bakery-accent">{reports.length}</div>
            <div className="text-sm text-bakery-muted">Reports</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-soft">
            <div className="text-2xl font-bold text-bakery-accent">{networkMembers.length}</div>
            <div className="text-sm text-bakery-muted">Connected Users</div>
          </div>
        </div>

        {/* User Info */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-soft mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Welcome, {user?.user_metadata?.full_name || user?.email}!
          </h2>
          <div className="space-y-2 text-sm text-bakery-muted">
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Account created:</strong> {new Date(user?.created_at).toLocaleDateString()}</p>
            <p><strong>Subscription:</strong> {profile?.subscription_status || 'trial'}</p>
          </div>
        </section>

        {/* Network Management (Premium Only) */}
        {isPremium && (
          <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-soft mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Network Members</h2>
              <button
                onClick={() => setInviteModalOpen(true)}
                className="bg-bakery-accent text-white px-4 py-2 rounded-lg text-sm hover:opacity-90"
              >
                + Invite User
              </button>
            </div>

            {networkMembers.length === 0 ? (
              <p className="text-bakery-muted text-sm">
                No connected users yet. Invite team members to share workflows and collaborate.
              </p>
            ) : (
              <div className="space-y-3">
                {networkMembers.map((member: any) => (
                  <div key={member.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {member.profiles?.device_name || member.profiles?.email}
                        {member.role === 'owner' && (
                          <span className="ml-2 text-xs bg-bakery-accent text-white px-2 py-1 rounded">
                            Owner
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-bakery-muted">{member.profiles?.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Last active: {new Date(member.last_active).toLocaleDateString()}
                      </p>
                    </div>
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Workflows Section */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Workflows</h2>
            <span className="text-sm text-bakery-muted">{workflows.length} total</span>
          </div>

          {workflows.length === 0 ? (
            <p className="text-bakery-muted text-sm">No workflows yet. Create one in the mobile app!</p>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{workflow.name}</h3>
                      <p className="text-sm text-bakery-muted mt-1">
                        {workflow.steps?.length || 0} steps
                      </p>
                      {workflow.claimed_by && (
                        <p className="text-xs text-bakery-accent mt-2">
                          Assigned to: {workflow.claimed_by_name || 'Unknown'}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Created: {new Date(workflow.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isPremium && networkMembers.length > 0 && (
                      <button
                        onClick={() => openAssignModal(workflow)}
                        className="bg-bakery-accent text-white px-4 py-2 rounded-lg text-sm hover:opacity-90"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Batches Section */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Active Batches</h2>
            <span className="text-sm text-bakery-muted">{activeBatches.length} in progress</span>
          </div>

          {activeBatches.length === 0 ? (
            <p className="text-bakery-muted text-sm">No active batches.</p>
          ) : (
            <div className="space-y-3">
              {activeBatches.slice(0, 5).map((batch) => (
                <div key={batch.id} className="border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold">{batch.name}</h3>
                  <p className="text-sm text-bakery-muted mt-1">
                    Step {batch.current_step_index + 1} of {batch.steps?.length || 0}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-bakery-accent h-2 rounded-full" 
                      style={{ width: `${((batch.current_step_index + 1) / (batch.steps?.length || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Reports */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Reports</h2>
            <span className="text-sm text-bakery-muted">{reports.length} total</span>
          </div>

          {reports.length === 0 ? (
            <p className="text-bakery-muted text-sm">No reports yet.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="border-b border-gray-100 py-2 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-sm font-medium">{report.type}</span>
                      <p className="text-xs text-gray-400">
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Photos */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Photos</h2>
            <span className="text-sm text-bakery-muted">{photos.length} total</span>
          </div>

          {photos.length === 0 ? (
            <p className="text-bakery-muted text-sm">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <img 
                    src={photo.url} 
                    alt="Batch photo" 
                    className="w-full h-32 object-cover"
                  />
                  <p className="text-xs text-gray-400 p-2">
                    {new Date(photo.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Assign Workflow Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              Assign Workflow: {selectedWorkflow?.name}
            </h3>

            <div className="space-y-2 mb-4">
              {networkMembers.map((member: any) => (
                <button
                  key={member.id}
                  onClick={() => handleAssignWorkflow(member.user_id)}
                  className="w-full text-left border border-gray-200 rounded-xl p-4 hover:bg-gray-50"
                >
                  <p className="font-medium">{member.profiles?.device_name || member.profiles?.email}</p>
                  <p className="text-sm text-bakery-muted">{member.profiles?.email}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setAssignModalOpen(false)}
              className="w-full bg-gray-200 text-bakery-ink px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Invite User to Network</h3>
            
            <input
              type="email"
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={handleInviteUser}
                className="flex-1 bg-bakery-accent text-white px-4 py-2 rounded-xl"
              >
                Send Invite
              </button>
              <button
                onClick={() => {
                  setInviteModalOpen(false)
                  setInviteEmail('')
                }}
                className="flex-1 bg-gray-200 text-bakery-ink px-4 py-2 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}