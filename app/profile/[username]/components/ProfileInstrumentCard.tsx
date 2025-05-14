"use client"

import { useState } from 'react';

interface Instrument {
  _id: string;
  title: string;
  description: string;
  surveyId: string;
  questionCount: number;
  responseCount: number;
  shareableLink: string;
  createdAt: string;
}

interface Props {
  instrument: Instrument;
  isOwner: boolean;
  onDelete: () => void;
}

export default function ProfileInstrumentCard({ instrument, isOwner, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this instrument?')) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/profile/instruments?id=${instrument._id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onDelete();
      } else {
        console.error('Failed to delete instrument');
      }
    } catch (error) {
      console.error('Error deleting instrument:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleCopyLink = () => {
    // Check if clipboard API is available
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(instrument.shareableLink)
        .then(() => {
          alert('Shareable link copied to clipboard!');
        })
        .catch(err => {
          console.error('Could not copy link', err);
          fallbackCopyTextToClipboard(instrument.shareableLink);
        });
    } else {
      // Use fallback method if Clipboard API is not available
      fallbackCopyTextToClipboard(instrument.shareableLink);
    }
  };

  // Add this fallback function with proper type annotation
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('Shareable link copied to clipboard!');
      } else {
        alert('Unable to copy link to clipboard.');
      }
    } catch (err) {
      console.error('Fallback: Unable to copy', err);
      alert('Unable to copy link to clipboard. Please copy it manually: ' + text);
    }
    
    document.body.removeChild(textArea);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="h-20 bg-emerald-100 flex items-center justify-center">
        <div className="text-emerald-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{instrument.title}</h3>
        
        {instrument.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{instrument.description}</p>
        )}
        
        <div className="flex justify-between text-sm text-gray-500 mb-3">
          <span>{instrument.questionCount} questions</span>
          <span>{instrument.responseCount} responses</span>
        </div>
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Created: {formatDate(instrument.createdAt)}</span>
          
          <div className="flex space-x-2">
            <button
              onClick={handleCopyLink}
              className="text-emerald-600 hover:text-emerald-700"
            >
              Copy Link
            </button>
            
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}