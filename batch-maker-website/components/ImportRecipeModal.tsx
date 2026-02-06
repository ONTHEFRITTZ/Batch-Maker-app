import { useState } from 'react';
import { parseRecipe, parseRecipeFromUrl, toWorkflowInsert, toBatchTemplateInsert, type ParsedRecipe } from '../lib/aiRecipeParser';
import { supabase } from '../lib/supabase';

interface ImportRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  locationId?: string;
  onSuccess?: () => void;
}

export default function ImportRecipeModal({ isOpen, onClose, userId, locationId, onSuccess }: ImportRecipeModalProps) {
  const [mode, setMode] = useState<'text' | 'url'>('text');
  const [recipeText, setRecipeText] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null);

  const handleParse = async () => {
    setLoading(true);
    setError(null);
    setParsedRecipe(null);

    try {
      let result;
      
      if (mode === 'url') {
        result = await parseRecipeFromUrl(recipeUrl);
      } else {
        result = await parseRecipe(recipeText);
      }

      if (result.success) {
        setParsedRecipe(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!parsedRecipe) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Create the workflow
      const workflowData = toWorkflowInsert(parsedRecipe, userId, locationId);
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .insert(workflowData)
        .select()
        .single();

      if (workflowError) throw workflowError;

      // 2. Create the batch template
      const templateData = toBatchTemplateInsert(parsedRecipe, userId, workflow.id);
      const { error: templateError } = await supabase
        .from('batch_templates')
        .insert(templateData);

      if (templateError) throw templateError;

      // Success!
      alert(`Successfully imported "${parsedRecipe.recipeName}"!`);
      
      // Reset form
      setRecipeText('');
      setRecipeUrl('');
      setParsedRecipe(null);
      
      // Call success callback
      if (onSuccess) onSuccess();
      
      // Close modal
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setParsedRecipe(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Import Recipe with AI</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {!parsedRecipe ? (
            <>
              {/* Mode Selection */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setMode('text')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    mode === 'text'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📝 Paste Recipe Text
                </button>
                <button
                  onClick={() => setMode('url')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    mode === 'url'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🔗 Import from URL
                </button>
              </div>

              {/* Input Area */}
              {mode === 'text' ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipe Text
                  </label>
                  <textarea
                    value={recipeText}
                    onChange={(e) => setRecipeText(e.target.value)}
                    placeholder="Paste your recipe here... Include ingredients and instructions."
                    className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Paste any recipe text and our AI will automatically extract ingredients, steps, and timing.
                  </p>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipe URL
                  </label>
                  <input
                    type="url"
                    value={recipeUrl}
                    onChange={(e) => setRecipeUrl(e.target.value)}
                    placeholder="https://example.com/recipe"
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Enter a URL to a recipe page and we'll extract the recipe for you.
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-red-500 text-xl">⚠️</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 mb-1">Error</h4>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleParse}
                  disabled={loading || (mode === 'text' ? !recipeText.trim() : !recipeUrl.trim())}
                  className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Parsing...
                    </span>
                  ) : (
                    '🤖 Parse Recipe with AI'
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Preview Parsed Recipe */}
              <div className="mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-green-700">
                    <span className="text-2xl">✓</span>
                    <span className="font-semibold">Recipe parsed successfully!</span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Recipe Header */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{parsedRecipe.recipeName}</h3>
                    {parsedRecipe.description && (
                      <p className="text-gray-600">{parsedRecipe.description}</p>
                    )}
                    {parsedRecipe.servings && (
                      <p className="text-sm text-gray-500 mt-2">Serves: {parsedRecipe.servings}</p>
                    )}
                    {parsedRecipe.totalEstimatedMinutes > 0 && (
                      <p className="text-sm text-gray-500">
                        Total Time: {parsedRecipe.totalEstimatedMinutes} minutes
                      </p>
                    )}
                  </div>

                  {/* Ingredients */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">
                      Ingredients ({parsedRecipe.ingredients.length})
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <ul className="space-y-2">
                        {parsedRecipe.ingredients.map((ing, idx) => (
                          <li key={idx} className="flex items-center gap-3 text-sm">
                            <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              {idx + 1}
                            </span>
                            <span className="font-medium">{ing.amount} {ing.unit}</span>
                            <span className="text-gray-700">{ing.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Steps */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">
                      Instructions ({parsedRecipe.steps.length} steps)
                    </h4>
                    <div className="space-y-3">
                      {parsedRecipe.steps.map((step, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start gap-3 mb-2">
                            <span className="w-8 h-8 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full font-bold">
                              {step.order}
                            </span>
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900">{step.title}</h5>
                              {step.duration_minutes > 0 && (
                                <span className="text-xs text-gray-500">⏱️ {step.duration_minutes} min</span>
                              )}
                              {step.temperature && (
                                <span className="text-xs text-gray-500 ml-3">
                                  🌡️ {step.temperature}°{step.temperature_unit || 'C'}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 ml-11">{step.description}</p>
                          {step.notes && (
                            <p className="text-xs text-gray-500 italic ml-11 mt-2">Note: {step.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Importing...' : '✓ Import as Workflow'}
                </button>
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}