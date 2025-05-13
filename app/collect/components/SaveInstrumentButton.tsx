"use client"

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';

interface Props {
  surveyId: string;
}

export default function SaveInstrumentButton({ surveyId }: Props) {
  const { isSignedIn } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/profile/instruments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surveyId,
          isPublic
        }),
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        alert('Survey instrument saved to your profile!');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save instrument');
      }
    } catch (err) {
      setError('An error occurred while saving');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isSignedIn) {
    return null; // Don't show save button if not signed in
  }
  
  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
      >
        Save to Profile
      </button>
      
      {/* Save Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Save Survey Instrument to Profile</h3>
            
            <form onSubmit={handleSave}>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Make this survey instrument public</span>
                </label>
              </div>
              
              {error && (
                <div className="mb-4 text-red-500 text-sm">{error}</div>
              )}
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 flex items-center"
                >
                  {isSaving && <Spinner className="w-4 h-4 mr-2" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}