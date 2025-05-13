"use client"

import { useState } from 'react';
import { Spinner } from '@/components/spinner';

interface Sketch {
  _id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  previewImage?: string;
  createdAt: string;
}

interface Props {
  sketch: Sketch;
  isOwner: boolean;
  onDelete: () => void;
}

export default function ProfileSketchCard({ sketch, isOwner, onDelete }: Props) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this sketch?')) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/profile/sketches?id=${sketch._id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onDelete();
      } else {
        console.error('Failed to delete sketch');
      }
    } catch (error) {
      console.error('Error deleting sketch:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Create an HTML preview from the sketch code
  const createGameHTML = (code: string, language: string) => {
    // Similar to the technique used in GameSandbox.tsx
    if (language === 'html' || code.includes('<!DOCTYPE html>') || code.includes('<html')) {
      return code;
    }
    
    // Wrap in HTML if it's just JavaScript
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game Preview</title>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script>
    ${code}
  </script>
</body>
</html>
    `;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Preview area */}
      {isPreviewMode ? (
        <div className="h-60 overflow-hidden">
          <iframe
            srcDoc={createGameHTML(sketch.code, sketch.language)}
            title="Game Preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts"
          />
        </div>
      ) : (
        <div className="h-60 bg-gray-100 flex items-center justify-center">
          {sketch.previewImage ? (
            <img 
              src={sketch.previewImage} 
              alt={sketch.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
            </div>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{sketch.title}</h3>
        
        {sketch.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{sketch.description}</p>
        )}
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Created: {formatDate(sketch.createdAt)}</span>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="text-emerald-600 hover:text-emerald-700"
            >
              {isPreviewMode ? 'Hide Preview' : 'Preview'}
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