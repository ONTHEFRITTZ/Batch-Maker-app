// pages/workflows/create.tsx
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '../../lib/supabase';

const supabase = getSupabaseClient();

interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  notes?: string;
}

export default function CreateWorkflow() {
  const router = useRouter();
  const [workflowName, setWorkflowName] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addStep() {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      title: '',
      description: '',
    };
    setSteps([...steps, newStep]);
  }

  function updateStep(index: number, field: keyof WorkflowStep, value: any) {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const newSteps = [...steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newSteps.length) return;
    
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
  }

  async function handleSave() {
    setError('');

    if (!workflowName.trim()) {
      setError('Please enter a workflow name');
      return;
    }

    if (steps.length === 0) {
      setError('Please add at least one step');
      return;
    }

    if (steps.some(s => !s.title.trim())) {
      setError('All steps must have a title');
      return;
    }

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const { error: insertError } = await supabase
        .from('workflows')
        .insert({
          user_id: session.user.id,
          name: workflowName,
          steps: steps,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      alert('Workflow created successfully!');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error creating workflow:', err);
      setError(err.message || 'Failed to create workflow');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Create New Workflow</h1>
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
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
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

            {steps.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No steps yet. Click "Add Step" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {steps.map((step, index) => (
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
                          {index < steps.length - 1 && (
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

          <button
            onClick={handleSave}
            disabled={saving || !workflowName || steps.length === 0}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}