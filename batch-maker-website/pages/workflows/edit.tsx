// pages/workflows/edit.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  notes?: string;
}

interface Workflow {
  id: string;
  user_id: string;
  name: string;
  steps: WorkflowStep[];
  claimed_by?: string;
  claimed_by_name?: string;
  created_at: string;
  updated_at: string;
}

export default function EditWorkflow() {
  const router = useRouter();
  const { id } = router.query;
  
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchWorkflow();
    }
  }, [id]);

  async function fetchWorkflow() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;

      setWorkflow(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching workflow:', err);
      setError(err.message || 'Failed to load workflow');
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!workflow) return;

    setSaving(true);
    setError('');

    try {
      const { error } = await supabase
        .from('workflows')
        .update({
          name: workflow.name,
          steps: workflow.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      if (error) throw error;

      alert('Workflow saved successfully!');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error saving workflow:', err);
      setError(err.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!workflow) return;
    
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('workflows')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      if (error) throw error;

      alert('Workflow deleted successfully');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error deleting workflow:', err);
      setError(err.message || 'Failed to delete workflow');
      setSaving(false);
    }
  }

  function updateWorkflowName(name: string) {
    if (workflow) {
      setWorkflow({ ...workflow, name });
    }
  }

  function updateStep(index: number, field: keyof WorkflowStep, value: any) {
    if (!workflow) return;
    
    const newSteps = [...workflow.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setWorkflow({ ...workflow, steps: newSteps });
  }

  function addStep() {
    if (!workflow) return;
    
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      title: '',
      description: '',
    };
    
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] });
  }

  function removeStep(index: number) {
    if (!workflow) return;
    
    const newSteps = workflow.steps.filter((_, i) => i !== index);
    setWorkflow({ ...workflow, steps: newSteps });
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    if (!workflow) return;
    
    const newSteps = [...workflow.steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newSteps.length) return;
    
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setWorkflow({ ...workflow, steps: newSteps });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading workflow...</div>
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <Link href="/dashboard" className="text-blue-500 underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Workflow not found</div>
          <Link href="/dashboard" className="text-blue-500 underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Edit Workflow</h1>
          <Link href="/dashboard" className="text-blue-500 hover:text-blue-600">
            ← Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workflow Name
            </label>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => updateWorkflowName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Sourdough Bread"
            />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Steps</h2>
              <button
                onClick={addStep}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                + Add Step
              </button>
            </div>

            {workflow.steps.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No steps yet. Click "Add Step" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {workflow.steps.map((step, index) => (
                  <div key={step.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">
                          Step {index + 1}
                        </span>
                        <div className="flex gap-1">
                          {index > 0 && (
                            <button
                              onClick={() => moveStep(index, 'up')}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Move up"
                            >
                              ▲
                            </button>
                          )}
                          {index < workflow.steps.length - 1 && (
                            <button
                              onClick={() => moveStep(index, 'down')}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Move down"
                            >
                              ▼
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeStep(index)}
                        className="text-red-500 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStep(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Step title"
                      />
                      <textarea
                        value={step.description || ''}
                        onChange={(e) => updateStep(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Step description (optional)"
                        rows={2}
                      />
                      <input
                        type="number"
                        value={step.duration || ''}
                        onChange={(e) => updateStep(index, 'duration', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Duration in minutes (optional)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !workflow.name || workflow.steps.length === 0}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Workflow'}
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:bg-gray-300"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-500 text-center">
          Created: {new Date(workflow.created_at).toLocaleString()}
          {workflow.updated_at !== workflow.created_at && (
            <> • Updated: {new Date(workflow.updated_at).toLocaleString()}</>
          )}
        </div>
      </div>
    </div>
  );
}