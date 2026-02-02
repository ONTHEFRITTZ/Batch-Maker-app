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
  const [selectedWorkflowForAssignment, setSelectedWorkflowForAssignment] =
    useState<string>('');

  useEffect(() => {
    if (!user) return;

    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 3000);
    return () => clearInterval(interval);
  }, [user]);

  async function fetchActiveSessions() {
    if (!user) return;

    const sessions: ActiveSession[] = [];

    const { data: activeBatches, error } = await supabase
      .from('batches')
      .select('*')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch active batches:', error);
      setActiveSessions([]);
      return;
    }

    if (!activeBatches || activeBatches.length === 0) {
      setActiveSessions([]);
      return;
    }

    for (const batch of activeBatches) {
      const isCurrentUser = batch.claimed_by === user.id;
      const member = networkMembers.find(m => m.user_id === batch.claimed_by);

      // HARD FILTER: only you or real network members
      if (!isCurrentUser && !member) continue;

      const workflow = workflows.find(w => w.id === batch.workflow_id);

      sessions.push({
        user_id: batch.claimed_by || user.id,
        device_name: isCurrentUser
          ? 'You'
          : batch.claimed_by_name ||
            member?.profiles?.device_name ||
            member?.profiles?.email ||
            'Unknown',
        current_workflow_id: batch.workflow_id,
        current_workflow_name: workflow?.name || batch.name,
        current_batch_id: batch.id,
        current_step: batch.current_step_index || 0,
        last_heartbeat: batch.updated_at || batch.created_at,
        status: 'working',
      });
    }

    setActiveSessions(sessions);
  }

  async function handleAssignWorkflow(
    workflowId: string,
    assignToUserId: string
  ) {
    try {
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) return;

      const member = networkMembers.find(m => m.user_id === assignToUserId);
      const isCurrentUser = assignToUserId === user.id;

      const deviceName =
        member?.profiles?.device_name ||
        member?.profiles?.email ||
        (isCurrentUser ? 'You' : 'Unknown');

      const { error } = await supabase
        .from('workflows')
        .update({
          claimed_by: assignToUserId,
          claimed_by_name: deviceName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId);

      if (error) throw error;

      await fetchWorkflows();
      await fetchBatches();

      setAssignWorkflowModalOpen(false);
    } catch (err) {
      console.error('Assign workflow failed:', err);
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

      await fetchWorkflows();
      await fetchBatches();
    } catch (err) {
      console.error('Unassign workflow failed:', err);
    }
  }

  const batchesByUser = activeSessions.reduce((acc, session) => {
    const userBatches = batches.filter(
      b => b.claimed_by === session.user_id && !b.completed_at
    );

    if (userBatches.length > 0) {
      acc[session.user_id] = {
        session,
        batches: userBatches,
      };
    }

    return acc;
  }, {} as Record<string, { session: ActiveSession; batches: typeof batches }>);

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
      {/* TEAM STATUS */}
      {isPremium && activeSessions.length > 0 && (
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">👥 Team Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map(session => (
              <div
                key={session.user_id}
                className="p-4 bg-gray-50 rounded-lg border-l-4 border-green-500"
              >
                <div className="flex justify-between mb-2">
                  <div className="font-semibold text-sm">
                    {session.device_name}
                  </div>
                  <span className="text-xs text-green-600">● Working</span>
                </div>

                <div className="text-sm text-blue-600">
                  {session.current_workflow_name}
                </div>

                <div className="text-xs text-gray-500">
                  Step {(session.current_step || 0) + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTIVE BATCHES */}
      {Object.keys(batchesByUser).length > 0 && (
        <div className="mb-6 space-y-6">
          <h2 className="text-xl font-semibold">🔨 Active Work Sessions</h2>

          {Object.entries(batchesByUser).map(
            ([userId, { session, batches }]) => (
              <div key={userId} className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-4">
                  {session.device_name} ({batches.length})
                </h3>

                {batches.map(batch => {
                  const workflow = workflows.find(
                    w => w.id === batch.workflow_id
                  );

                  const currentStep = batch.current_step_index || 0;
                  const totalSteps = workflow?.steps?.length || 0;
                  const progress =
                    totalSteps > 0
                      ? (currentStep / totalSteps) * 100
                      : 0;

                  return (
                    <div
                      key={batch.id}
                      className="p-4 bg-gray-50 rounded-lg mb-3"
                    >
                      <div className="font-semibold">{batch.name}</div>
                      <div className="text-xs text-gray-500">
                        Step {currentStep + 1}/{totalSteps}
                      </div>

                      <div className="w-full h-2 bg-gray-200 rounded mt-2">
                        <div
                          className="h-full bg-green-500 rounded"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* WORKFLOWS */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-semibold">📋 All Workflows</h2>
          <Link
            href="/workflows/create"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
          >
            + Create Workflow
          </Link>
        </div>

        <div className="space-y-4">
          {workflows.map(workflow => {
            const activeBatch = batches.find(
              b => b.workflow_id === workflow.id && !b.completed_at
            );

            return (
              <div
                key={workflow.id}
                className="p-4 bg-gray-50 rounded-lg flex justify-between"
              >
                <div>
                  <div className="font-semibold">{workflow.name}</div>
                  <div className="text-xs text-gray-500">
                    {activeBatch ? '● Active' : '○ Idle'}
                  </div>
                </div>

                {isPremium && (
                  <>
                    {!workflow.claimed_by ? (
                      <button
                        onClick={() => {
                          setSelectedWorkflowForAssignment(workflow.id);
                          setAssignWorkflowModalOpen(true);
                        }}
                        className="px-3 py-2 bg-green-500 text-white rounded text-sm"
                      >
                        Assign
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnassignWorkflow(workflow.id)}
                        className="px-3 py-2 bg-red-500 text-white rounded text-sm"
                      >
                        Unassign
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ASSIGN MODAL */}
      {assignWorkflowModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setAssignWorkflowModalOpen(false)}
        >
          <div
            className="bg-white p-6 rounded-xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Assign Workflow</h3>

            <select
              className="w-full border p-3 rounded mb-4"
              onChange={e =>
                handleAssignWorkflow(
                  selectedWorkflowForAssignment,
                  e.target.value
                )
              }
            >
              <option value="">Select member</option>
              {assignableMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setAssignWorkflowModalOpen(false)}
              className="w-full bg-gray-100 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
