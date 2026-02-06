import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Document {
  id: string;
  name: string;
  description?: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  is_auto_send: boolean;
  category?: string;
  created_at: string;
  created_by?: string;
}

interface UserDocument {
  id: string;
  user_id: string;
  document_id: string;
  status: string;
  completed_at?: string;
  file_url?: string;
  notes?: string;
  document: Document;
}

interface DocumentManagerProps {
  userId?: string;
  isAdmin?: boolean;
}

export default function DocumentManager({ userId, isAdmin = false }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    category: 'general',
    is_auto_send: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
    if (userId) {
      fetchUserDocuments();
    }
  }, [userId]);

  async function fetchDocuments() {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      // Fixed: Query documents created by current user
      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError(`Failed to load documents: ${fetchError.message}`);
        return;
      }
      
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserDocuments() {
    if (!userId) return;

    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('user_documents')
        .select(`
          *,
          document:documents(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('User documents fetch error:', fetchError);
        setError(`Failed to load user documents: ${fetchError.message}`);
        return;
      }
      
      setUserDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching user documents:', error);
      setError(`Error: ${error.message}`);
    }
  }

  async function handleUploadDocument() {
    if (!selectedFile || !uploadForm.name) {
      alert('Please select a file and provide a name');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('Starting upload...', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      });

      // Create unique file name
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${session.user.id}/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('business-documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('business-documents')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      // Create document record
      const documentData = {
        name: uploadForm.name,
        description: uploadForm.description || null,
        file_url: publicUrl,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        is_auto_send: uploadForm.is_auto_send,
        category: uploadForm.category,
        created_by: session.user.id,
      };

      console.log('Creating document record:', documentData);

      const { error: dbError, data: insertedDoc } = await supabase
        .from('documents')
        .insert(documentData)
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        // Try to clean up uploaded file
        await supabase.storage
          .from('business-documents')
          .remove([filePath]);
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log('Document created successfully:', insertedDoc);

      alert('Document uploaded successfully!');
      setShowUploadModal(false);
      setUploadForm({
        name: '',
        description: '',
        category: 'general',
        is_auto_send: false,
      });
      setSelectedFile(null);
      
      await fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      setError(error.message);
      alert(`Failed to upload document: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleToggleAutoSend(documentId: string, currentValue: boolean) {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('documents')
        .update({ is_auto_send: !currentValue })
        .eq('id', documentId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setDocuments(documents.map(doc => 
        doc.id === documentId ? { ...doc, is_auto_send: !currentValue } : doc
      ));
    } catch (error: any) {
      console.error('Error toggling auto-send:', error);
      setError(error.message);
      alert(`Failed to update document: ${error.message}`);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setError(null);
    try {
      // First, get the document to find the file URL
      const doc = documents.find(d => d.id === documentId);
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Try to delete file from storage (best effort)
      if (doc?.file_url) {
        try {
          const url = new URL(doc.file_url);
          const pathParts = url.pathname.split('/');
          const filePath = pathParts.slice(-3).join('/'); // Get last 3 parts: documents/userId/filename
          
          await supabase.storage
            .from('business-documents')
            .remove([filePath]);
        } catch (storageError) {
          console.warn('Could not delete file from storage:', storageError);
        }
      }

      setDocuments(documents.filter(doc => doc.id !== documentId));
      alert('Document deleted');
    } catch (error: any) {
      console.error('Error deleting document:', error);
      setError(error.message);
      alert(`Failed to delete document: ${error.message}`);
    }
  }

  async function handleMarkComplete(userDocumentId: string, documentId: string) {
    const file = await promptFileUpload();
    if (!file) return;

    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Upload completed document
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-completed.${fileExt}`;
      const filePath = `completed/${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('business-documents')
        .upload(filePath, file);

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('business-documents')
        .getPublicUrl(filePath);

      // Update user_document record
      const { error: updateError } = await supabase
        .from('user_documents')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          file_url: publicUrl,
        })
        .eq('id', userDocumentId);

      if (updateError) throw new Error(updateError.message);

      await fetchUserDocuments();
      alert('Document marked as completed');
    } catch (error: any) {
      console.error('Error marking document complete:', error);
      setError(error.message);
      alert(`Failed to mark document as completed: ${error.message}`);
    }
  }

  function promptFileUpload(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        resolve(file || null);
      };
      input.click();
    });
  }

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'tax', label: 'Tax Forms' },
    { value: 'legal', label: 'Legal' },
    { value: 'nda', label: 'NDA' },
    { value: 'training', label: 'Training' },
    { value: 'safety', label: 'Safety' },
  ];

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">⚠️ {error}</p>
        </div>
      )}

      {/* Admin View - All Documents */}
      {isAdmin && (
        <div className="bg-white/90 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Document Templates</h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage documents that can be assigned to team members
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Upload Document
            </button>
          </div>

          {documents.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No documents yet. Upload your first document template.
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                        {doc.is_auto_send && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            Auto-send
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          {doc.category}
                        </span>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                      )}
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>{doc.file_type}</span>
                        <span>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.open(doc.file_url, '_blank')}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleToggleAutoSend(doc.id, doc.is_auto_send)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          doc.is_auto_send
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {doc.is_auto_send ? 'Auto-send ✓' : 'Manual'}
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
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
      )}

      {/* User View - Assigned Documents */}
      {userId && (
        <div className="bg-white/90 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Assigned Documents</h2>

          {userDocuments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No documents assigned yet
            </p>
          ) : (
            <div className="space-y-3">
              {userDocuments.map(userDoc => (
                <div key={userDoc.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{userDoc.document.name}</h3>
                        {userDoc.status === 'completed' ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            ✓ Completed
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                            Pending
                          </span>
                        )}
                      </div>
                      {userDoc.document.description && (
                        <p className="text-sm text-gray-600 mb-2">{userDoc.document.description}</p>
                      )}
                      {userDoc.completed_at && (
                        <p className="text-xs text-gray-500">
                          Completed on {new Date(userDoc.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.open(userDoc.document.file_url, '_blank')}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      >
                        View Template
                      </button>
                      {userDoc.file_url && (
                        <button
                          onClick={() => window.open(userDoc.file_url, '_blank')}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          View Completed
                        </button>
                      )}
                      {userDoc.status !== 'completed' && isAdmin && (
                        <button
                          onClick={() => handleMarkComplete(userDoc.id, userDoc.document_id)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowUploadModal(false)}
        >
          <div 
            className="bg-white/90 rounded-xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                  placeholder="W-4 Tax Form"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                  placeholder="Employee tax withholding form"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({...uploadForm, category: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File *
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto-send"
                  checked={uploadForm.is_auto_send}
                  onChange={(e) => setUploadForm({...uploadForm, is_auto_send: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="auto-send" className="ml-2 text-sm text-gray-700">
                  Auto-send with invitation emails
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocument}
                disabled={uploading || !selectedFile || !uploadForm.name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}