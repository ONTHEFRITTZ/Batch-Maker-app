'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../../Batch Maker/app/lib/supabase';
import Link from 'next/link';

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  timer_minutes?: number;
  photo_required?: boolean;
  tasks?: Array<{
    id: string;
    name: string;
    completed: boolean;
  }>;
}

export default function WorkflowEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workflowId = searchParams?.get('id');
  const isEditing = !!workflowId;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [workflowName, setWorkflowName] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user && workflowId) {
      loadWorkflow();
    }
  }, [user, workflowId]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      window.location.href = '/login';
      return;
    }

    setUser(session.user);
    setLoading(false);
  }

  async function loadWorkflow() {
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error || !workflow) {
      alert('Workflow not found');
      router.push('/dashboard');
      return;
    }

    setWorkflowName(workflow.name);
    setSteps(workflow.steps || []);
  }

  function addStep() {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      name: 'New Step',
      description: '',
      timer_minutes: undefined,
      photo_required: false,
      tasks: [],
    };
    setSteps([...steps, newStep]);
    setEditingStepId(newStep.id);
  }

  function updateStep(stepId: string, updates: Partial<WorkflowStep>) {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }

  function deleteStep(stepId: string) {
    setSteps(steps.filter(step => step.id !== stepId));
  }

  function moveStepUp(index: number) {
    if (index === 0) return;
    const newSteps = [...steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setSteps(newSteps);
  }

  function moveStepDown(index: number) {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setSteps(newSteps);
  }

  function addTask(stepId: string) {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const newTask = {
      id: `task_${Date.now()}`,
      name: 'New Task',
      completed: false,
    };

    updateStep(stepId, {
      tasks: [...(step.tasks || []), newTask],
    });
  }

  function updateTask(stepId: string, taskId: string, name: string) {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    updateStep(stepId, {
      tasks: step.tasks?.map(task => 
        task.id === taskId ? { ...task, name } : task
      ),
    });
  }

  function deleteTask(stepId: string, taskId: string) {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    updateStep(stepId, {
      tasks: step.tasks?.filter(task => task.id !== taskId),
    });
  }

  async function handleSave() {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    if (steps.length === 0) {
      alert('Please add at least one step');
      return;
    }

    setSaving(true);

    try {
      const workflowData = {
        user_id: user.id,
        name: workflowName,
        steps: steps,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        // Update existing workflow
        const { error } = await supabase
          .from('workflows')
          .update(workflowData)
          .eq('id', workflowId);

        if (error) throw error;
      } else {
        // Create new workflow
        const { error } = await supabase
          .from('workflows')
          .insert({
            ...workflowData,
            id: `wf_${Date.now()}`,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-5xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditing ? 'Edit Workflow' : 'Create Workflow'}
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Workflow Name */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Workflow Name *
          </label>
          <input
            type="text"
            value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            placeholder="e.g., Sourdough Bread"
            className="w-full p-3 border border-gray-300 rounded-lg text-lg"
          />
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Steps</h2>
            <button
              onClick={addStep}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
            >
              + Add Step
            </button>
          </div>

          {steps.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No steps yet. Click "Add Step" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveStepUp(index)}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveStepDown(index)}
                          disabled={index === steps.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="font-semibold text-gray-500">
                        Step {index + 1}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteStep(step.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Step Name *
                      </label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={e => updateStep(step.id, { name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="e.g., Mix ingredients"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={step.description}
                        onChange={e => updateStep(step.id, { description: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md min-h-[60px]"
                        placeholder="Optional instructions..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Timer (minutes)
                        </label>
                        <input
                          type="number"
                          value={step.timer_minutes || ''}
                          onChange={e => updateStep(step.id, { 
                            timer_minutes: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="Optional"
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={step.photo_required || false}
                            onChange={e => updateStep(step.id, { photo_required: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Photo Required</span>
                        </label>
                      </div>
                    </div>

                    {/* Tasks */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Tasks (optional)
                        </label>
                        <button
                          onClick={() => addTask(step.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          + Add Task
                        </button>
                      </div>

                      {step.tasks && step.tasks.length > 0 && (
                        <div className="space-y-2">
                          {step.tasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={task.name}
                                onChange={e => updateTask(step.id, task.id, e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-md text-sm"
                                placeholder="Task name"
                              />
                              <button
                                onClick={() => deleteTask(step.id, task.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}