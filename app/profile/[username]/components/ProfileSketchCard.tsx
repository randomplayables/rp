"use client"

import { useState } from 'react';

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
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
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

  // Function to open the preview in a new tab
  const openInNewTab = () => {
    const gameHTML = createGameHTML(sketch.code, sketch.language);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(gameHTML);
      newWindow.document.title = sketch.title;
      newWindow.document.close();
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
              onClick={() => setIsFullscreenMode(true)}
              className="text-emerald-600 hover:text-emerald-700"
            >
              Preview
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

      {/* Fullscreen Modal */}
      {isFullscreenMode && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-6xl flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">{sketch.title}</h3>
              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                srcDoc={createGameHTML(sketch.code, sketch.language)}
                title="Game Preview"
                className="w-full h-full border-none"
                sandbox="allow-scripts"
              />
            </div>
            <div className="p-4 border-t flex justify-end space-x-4">
              <button 
                onClick={openInNewTab}
                className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Open in New Tab
              </button>
              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}