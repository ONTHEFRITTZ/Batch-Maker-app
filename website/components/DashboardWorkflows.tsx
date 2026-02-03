import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DashboardProps, ActiveSession } from '../lib/dashboard-types';
import { supabase } from '../lib/supabase';

export default function Workflows({
  user,
  workflows,
  batches,
  networkMembers,
  isPremium,
  fetchWorkflows,
  fetchBatches,
}: DashboardProps) {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [assignWorkflowModalOpen, setAssignWorkflowModalOpen] = useState(false);
  const [selectedWorkflowForAssignment, setSelectedWorkflowForAssignment] = useState<string>('');

  useEffect(() => {
    if (!user) return;

    fetchActiveSessions();
    // FIX 6: Only depend on [user] so the interval isn't constantly torn down
    // and restarted every time batches/workflows/networkMembers change.
    const interval = setInterval(fetchActiveSessions, 3000);

    // Real-time subscription for instant updates
    const batchChannel = supabase
      .channel('workflows-batches-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batches',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('Batch changed, refreshing active sessions');
          fetchActiveSessions();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(batchChannel);
    };
  }, [user]);

  async function fetchActiveSessions() {
    if (!user) return;
    
    const sessions: ActiveSession[] = [];
    
    // Get all active batches with fresh data
    const { data: activeBatches } = await supabase
      .from('batches')
      .select('*')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .order('updated_at', { ascending: false });

    // Fetch fresh workflows and network members
    const { data: freshWorkflows } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const { data: freshMembers } = await supabase
      .from('network_members')
      .select('*, profiles:user_id(device_name, email)')
      .eq('owner_id', user.id);

    // Map batches to sessions
    if (activeBatches) {
      for (const batch of activeBatches) {
        const workflow = freshWorkflows?.find(w => w.id === batch.workflow_id);
        const member = freshMembers?.find(m => m.user_id === batch.claimed_by);
        
        // Determine who's working on this batch
        const isCurrentUser = !batch.claimed_by || batch.claimed_by === user.id;
        const workingUserId = batch.claimed_by || user.id;
        
        let deviceName = 'Unknown Device';
        if (isCurrentUser) {
          deviceName = 'You';
        } else if (batch.claimed_by_name) {
          deviceName = batch.claimed_by_name;
        } else if (member?.profiles?.device_name) {
          deviceName = member.profiles.device_name;
        } else if (member?.profiles?.email) {
          deviceName = member.profiles.email;
        }
        
        sessions.push({
          user_id: workingUserId,
          device_name: deviceName,
          current_workflow_id: batch.workflow_id,
          current_workflow_name: workflow?.name || batch.name,
          current_batch_id: batch.id,
          current_step: batch.current_step_index || 0,
          last_heartbeat: batch.updated_at || batch.created_at,
          status: 'working',
        });
      }
    }

    // FIX 4: Also surface assigned workflows that don't have an active batch yet.
    // Without this, a workflow assigned to a user never appears in Team Status
    // until a batch is actually created and running.
    freshWorkflows?.forEach(workflow => {
      if (workflow.claimed_by && !sessions.find(s => s.current_workflow_id === workflow.id)) {
        const member = freshMembers?.find(m => m.user_id === workflow.claimed_by);
        const isCurrentUser = workflow.claimed_by === user.id;
        
        sessions.push({
          user_id: workflow.claimed_by,
          device_name: workflow.claimed_by_name || (isCurrentUser ? 'You' : member?.profiles?.device_name || 'Unknown'),
          current_workflow_id: workflow.id,
          current_workflow_name: workflow.name,
          last_heartbeat: workflow.updated_at || new Date().toISOString(),
          status: 'idle', // assigned but no active batch = idle
        });
      }
    });

    // Add idle network members (only if not already represented)
    freshMembers?.forEach(member => {
      if (!sessions.find(s => s.user_id === member.user_id)) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const isOnline = member.last_active > fiveMinutesAgo;
        
        sessions.push({
          user_id: member.user_id,
          device_name: member.profiles?.device_name || member.profiles?.email || 'Unknown',
          last_heartbeat: member.last_active,
          status: isOnline ? 'idle' : 'offline',
        });
      }
    });

    // FIX 1a: Always make sure the current user appears in sessions
    // so they show up in Team Status and can be assigned workflows.
    if (!sessions.find(s => s.user_id === user.id)) {
      sessions.push({
        user_id: user.id,
        device_name: 'You',
        last_heartbeat: new Date().toISOString(),
        status: 'idle',
      });
    }

    setActiveSessions(sessions);
  }

  async function handleAssignWorkflow(workflowId: string, assignToUserId: string) {
    try {
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) {
        alert('Workflow not found');
        return;
      }

      // FIX 1b: Resolve the device name — check networkMembers first,
      // then fall back to 'You' if assigning to yourself.
      const member = networkMembers.find(m => m.user_id === assignToUserId);
      const isCurrentUser = assignToUserId === user.id;
      const deviceName = member?.profiles?.device_name || member?.profiles?.email || (isCurrentUser ? 'You' : 'Unknown');

      const { error } = await supabase
        .from('workflows')
        .update({
          claimed_by: assignToUserId,
          claimed_by_name: deviceName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId);

      if (error) throw error;

      // Immediately refresh to show changes
      await fetchWorkflows();
      await fetchBatches();
      
      setAssignWorkflowModalOpen(false);
      alert(`Workflow "${workflow.name}" assigned to ${deviceName}`);
    } catch (error) {
      console.error('Error assigning workflow:', error);
      alert('Failed to assign workflow');
    }
  }

  async function handleUnassignWorkflow(workflowId: string) {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({
          claimed_by: null,
          claimed_by_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId);

      if (error) throw error;

      // Immediately refresh to show changes
      await fetchWorkflows();
      await fetchBatches();
      
      alert('Workflow unassigned');
    } catch (error) {
      console.error('Error unassigning workflow:', error);
      alert('Failed to unassign workflow');
    }
  }

  // Group active batches by user
  const batchesByUser = activeSessions
    .filter(s => s.status === 'working')
    .reduce((acc, session) => {
      const userBatches = batches.filter(b => 
        b.claimed_by === session.user_id && !b.completed_at
      );
      if (userBatches.length > 0) {
        acc[session.user_id] = {
          session,
          batches: userBatches,
        };
      }
      return acc;
    }, {} as Record<string, { session: ActiveSession; batches: typeof batches }>);

  // FIX 1c: Build the assignable members list: always include yourself,
  // then add any network members that aren't already in the list.
  const assignableMembers = [
    { id: user.id, label: 'You' },
    ...networkMembers
      .filter(m => m.user_id !== user.id)
      .map(m => ({
        id: m.user_id,
        label: m.profiles?.device_name || m.profiles?.email || 'Unknown',
      })),
  ];

  return (
    <>
      {/* Real-Time Active Sessions */}
      {isPremium && activeSessions.length > 0 && (
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">👥 Team Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map(session => (
              <div 
                key={session.user_id} 
                className={`p-4 bg-gray-50 rounded-lg border-l-4 ${
                  session.status === 'working' ? 'border-green-500' :
                  session.status === 'idle' ? 'border-yellow-500' : 'border-gray-400'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <span className={`w-2 h-2 rounded-full ${
                      session.status === 'working' ? 'bg-green-500 animate-pulse' :
                      session.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}></span>
                    {session.device_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {session.status === 'working' ? '🔨 Working' :
                     session.status === 'idle' ? '⏸️ Idle' : '⚫ Offline'}
                  </div>
                </div>

                {session.status === 'working' && (
                  <div className="mb-2">
                    <div className="text-sm font-medium text-blue-600 mb-1">
                      {session.current_workflow_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Step {(session.current_step || 0) + 1}
                    </div>
                  </div>
                )}

                {/* FIX 4: Show assigned workflow name even when idle (no active batch) */}
                {session.status === 'idle' && session.current_workflow_name && (
                  <div className="mb-2">
                    <div className="text-sm font-medium text-yellow-600 mb-1">
                      Assigned: {session.current_workflow_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Waiting to start
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Last active: {new Date(session.last_heartbeat).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Batches - Organized by User */}
      {Object.keys(batchesByUser).length > 0 && (
        <div className="mb-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">🔨 Active Work Sessions</h2>
          
          {Object.entries(batchesByUser).map(([userId, { session, batches: userBatches }]) => (
            <div key={userId} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                <div className={`w-3 h-3 rounded-full ${
                  session.status === 'working' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
                <h3 className="text-lg font-semibold text-gray-900">{session.device_name}</h3>
                <span className="text-xs text-gray-500">
                  ({userBatches.length} active {userBatches.length === 1 ? 'batch' : 'batches'})
                </span>
              </div>

              <div className="space-y-3">
                {userBatches.map(batch => {
                  const workflow = workflows.find(w => w.id === batch.workflow_id);
                  const progress = workflow?.steps 
                    ? ((batch.current_step_index || 0) / workflow.steps.length) * 100
                    : 0;
                  const currentStep = batch.current_step_index || 0;
                  const totalSteps = workflow?.steps?.length || 0;
            
                  return (
                    <div key={batch.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-green-500">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">{batch.name}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            Workflow: {workflow?.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500">
                            Started: {new Date(batch.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            Step {currentStep + 1}/{totalSteps}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(progress)}% complete
                          </div>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-green-500 transition-all duration-300" 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>

                      {workflow?.steps && workflow.steps[currentStep] && (
                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                          <div className="text-xs font-medium text-gray-700 mb-1">Current Step:</div>
                          <div className="text-sm text-gray-900">
                            {workflow.steps[currentStep].title || `Step ${currentStep + 1}`}
                          </div>
                          {workflow.steps[currentStep].description && (
                            <div className="text-xs text-gray-600 mt-1">
                              {workflow.steps[currentStep].description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Workflows */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-semibold text-gray-900">📋 All Workflows</h2>
          <Link href="/workflows/create" className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            + Create Workflow
          </Link>
        </div>

        {workflows.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-8">
            No workflows yet. Create your first workflow to get started!
          </p>
        ) : (
          <div className="space-y-4">
            {workflows.map(workflow => {
              const activeBatch = batches.find(b => b.workflow_id === workflow.id && !b.completed_at);
              const isActive = !!activeBatch;
              const isAssigned = !!workflow.claimed_by;

              return (
                <div 
                  key={workflow.id} 
                  className={`p-5 bg-gray-50 rounded-lg border-l-4 flex justify-between items-center gap-4 flex-wrap ${
                    isActive ? 'border-green-500' : isAssigned ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{workflow.name}</span>
                        {/* FIX 2: Show appropriate status badge for every workflow */}
                        {isActive && <span className="text-xs text-green-500 font-medium">● Active</span>}
                        {!isActive && isAssigned && <span className="text-xs text-blue-500 font-medium">● Assigned</span>}
                        {!isActive && !isAssigned && <span className="text-xs text-gray-400 font-medium">○ Open</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        Created {new Date(workflow.created_at).toLocaleDateString()}
                        {workflow.steps && ` • ${workflow.steps.length} steps`}
                      </div>
                    </div>

                    {/* FIX 3: Show who it's assigned to, resolving 'You' for the current user */}
                    {isAssigned && (
                      <div className="text-sm text-blue-600 mt-2">
                        👤 Assigned to: {workflow.claimed_by === user.id ? 'You' : workflow.claimed_by_name || 'Unknown'}
                        {isActive && activeBatch && (
                          <span className="text-gray-500">
                            {' • Step '}{(activeBatch.current_step_index || 0) + 1}/{workflow.steps?.length || '?'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Link 
                      href={`/workflows/edit?id=${workflow.id}`} 
                      className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      View
                    </Link>

                    {isPremium && (
                      <>
                        {!isAssigned ? (
                          <button
                            onClick={() => {
                              setSelectedWorkflowForAssignment(workflow.id);
                              setAssignWorkflowModalOpen(true);
                            }}
                            className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 transition-colors"
                          >
                            Assign
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnassignWorkflow(workflow.id)}
                            className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors"
                          >
                            Unassign
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Workflow Modal */}
      {assignWorkflowModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAssignWorkflowModalOpen(false)}>
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Assign Workflow</h3>
            
            <p className="mb-4 text-gray-500">
              Select a team member to assign this workflow to:
            </p>

            {/* FIX 1c: Use the pre-built assignableMembers list which always includes you */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAssignWorkflow(selectedWorkflowForAssignment, e.target.value);
                }
              }}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Select team member</option>
              {assignableMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setAssignWorkflowModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}