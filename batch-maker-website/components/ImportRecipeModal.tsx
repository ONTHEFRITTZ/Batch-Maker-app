/**
* Location: batch-maker-website/components/ImportRecipeModal.tsx
 */

import { useState } from 'react';
import { saveRecipeFromUrl, saveRecipeFromText } from '../lib/aiRecipeParser';
import type { SaveRecipeResult } from '../lib/aiRecipeParser';

interface ImportRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  locationId?: string;
  onSuccess?: (workflowId: string) => void;
  onWorkflowCreated?: () => void; // NEW: Callback to refetch workflows list
}

export default function ImportRecipeModal({
  isOpen,
  onClose,
  userId,
  locationId,
  onSuccess,
  onWorkflowCreated, // NEW
}: ImportRecipeModalProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SaveRecipeResult | null>(null);

  if (!isOpen) return null;

  const handleUrlImport = async () => {
    if (!url.trim()) {
      setResult({ 
        success: false, 
        error: 'PARSE_FAILURE',
        message: 'Please enter a URL' 
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await saveRecipeFromUrl(url, locationId);
      setResult(res);

      if (res.success && res.workflowId) {
        setUrl(''); // Clear input on success
        
        // Call both callbacks
        if (onSuccess) {
          onSuccess(res.workflowId);
        }
        if (onWorkflowCreated) {
          onWorkflowCreated(); // NEW: Trigger refetch
        }
        
        // Auto-close after 2 seconds on success
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: 'UNKNOWN',
        message: err.message || 'Failed to import recipe',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTextImport = async () => {
    if (!text.trim()) {
      setResult({ 
        success: false, 
        error: 'PARSE_FAILURE',
        message: 'Please paste a recipe' 
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await saveRecipeFromText(text, locationId);
      setResult(res);

      if (res.success && res.workflowId) {
        setText(''); // Clear input on success
        
        // Call both callbacks
        if (onSuccess) {
          onSuccess(res.workflowId);
        }
        if (onWorkflowCreated) {
          onWorkflowCreated(); // NEW: Trigger refetch
        }
        
        // Auto-close after 2 seconds on success
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: 'UNKNOWN',
        message: err.message || 'Failed to import recipe',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing while loading
    setUrl('');
    setText('');
    setResult(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Import Recipe</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('url')}
              disabled={loading}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'url'
                  ? 'border-b-2 border-amber-600 text-amber-600'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              From URL
            </button>
            <button
              onClick={() => setActiveTab('text')}
              disabled={loading}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'text'
                  ? 'border-b-2 border-amber-600 text-amber-600'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              From Text
            </button>
          </div>

          {/* URL Import */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Recipe URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/chocolate-chip-cookies"
                  disabled={loading}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Paste a link to any recipe from the web. Our AI will extract the ingredients and steps automatically.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>1. Paste a recipe URL from any website</li>
                  <li>2. App fetches and reads the page</li>
                  <li>3. Recipe is parsed and saved to your workflows</li>
                  <li>4. Ready to use in batches!</li>
                </ul>
              </div>

              <button
                onClick={handleUrlImport}
                disabled={loading || !url.trim()}
                className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-400 hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    <span>Importing recipe...</span>
                  </>
                ) : (
                  <>
                    <span></span>
                    <span>Import Recipe</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Text Import */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Recipe Text
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your recipe here...

Example:
Chocolate Chip Cookies

Ingredients:
- 2 cups all-purpose flour
- 1 cup butter, softened
- 3/4 cup sugar
- 1 cup chocolate chips
- 2 eggs
- 1 tsp vanilla extract
- 1 tsp baking soda
- 1/2 tsp salt

Instructions:
1. Preheat oven to 350°F
2. Mix butter and sugar until fluffy
3. Add eggs and vanilla
4. Combine dry ingredients, mix into wet
5. Fold in chocolate chips
6. Drop onto baking sheet
7. Bake 10-12 minutes"
                  disabled={loading}
                  rows={14}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm disabled:bg-gray-100"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Paste a recipe from anywhere - email, notes, screenshot text, or just type it in.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">App will automatically:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Extract ingredients with amounts and units</li>
                  <li>• Parse steps in the correct order</li>
                  <li>• Calculate total time estimates</li>
                  <li>• Format everything for batch production</li>
                </ul>
              </div>

              <button
                onClick={handleTextImport}
                disabled={loading || !text.trim()}
                className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-400 hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    <span>Importing recipe...</span>
                  </>
                ) : (
                  <>
                    <span></span>
                    <span>Import Recipe</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Result Message */}
          {result && (
            <div
              className={`mt-6 p-4 rounded-lg border ${
                result.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {result.success ? '✅' : '❌'}
                </span>
                <div className="flex-1">
                  <p className={`font-medium mb-1 ${
                    result.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {result.success ? 'Success!' : 'Import Failed'}
                  </p>
                  <p className={`text-sm ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.message}
                  </p>
                  {result.success && (
                    <p className="text-xs text-green-600 mt-2">
                      Closing automatically...
                    </p>
                  )}
                  {!result.success && result.error === 'RATE_LIMITED' && (
                    <p className="text-xs text-red-600 mt-2">
                      You've reached your import limit. Please try again later.
                    </p>
                  )}
                  {!result.success && result.error === 'UNAUTHORIZED' && (
                    <p className="text-xs text-red-600 mt-2">
                      Please make sure you're signed in and try again.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}