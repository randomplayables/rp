"use client"

import { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface Visualization {
  _id: string;
  title: string;
  description: string;
  code: string;
  previewImage?: string;
  createdAt: string;
}

interface Props {
  visualization: Visualization;
  isOwner: boolean;
  onDelete: () => void;
}

export default function ProfileVisualizationCard({ visualization, isOwner, onDelete }: Props) {
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this visualization?')) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/profile/visualizations?id=${visualization._id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onDelete();
      } else {
        console.error('Failed to delete visualization');
      }
    } catch (error) {
      console.error('Error deleting visualization:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Render D3 visualization in the provided container
  const renderVisualization = (container: HTMLDivElement) => {
    try {
      console.log('Running d3 visualization on container element');
      container.innerHTML = ''; // Clear previous content
      
      // Make sure d3 is available
      if (typeof d3 === 'undefined') {
        setRenderError('Error: D3 library is not available');
        console.error('D3 is not defined');
        return;
      }
      
      try {
        // Create a function from the code and execute it
        const vizFunction = new Function('d3', 'container', visualization.code);
        vizFunction(d3, container);
      } catch (execError) {
        const errorMsg = `Error executing visualization code: ${execError instanceof Error ? execError.message : 'Unknown error'}`;
        console.error(errorMsg, execError);
        container.innerHTML = `<div class="text-red-500 p-4">${errorMsg}</div>`;
        setRenderError(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Error in visualization rendering process: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg, error);
      setRenderError(errorMsg);
    }
  };
  
  // Effect for fullscreen mode
  useEffect(() => {
    if (isFullscreenMode && fullscreenContainerRef.current) {
      renderVisualization(fullscreenContainerRef.current);
    }
  }, [isFullscreenMode, visualization.code]);

  // Function to create a standalone HTML document with the visualization
  const createVisualizationHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${visualization.title}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; }
    #viz-container { 
      width: 100%; 
      height: 100%; 
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div id="viz-container"></div>
  <script>
    // Wait for D3 to load
    document.addEventListener('DOMContentLoaded', function() {
      const container = document.getElementById('viz-container');
      try {
        ${visualization.code}
      } catch (error) {
        container.innerHTML = '<div style="color: red; padding: 20px;">Error: ' + error.message + '</div>';
      }
    });
  </script>
</body>
</html>
    `;
  };

  // Function to open the visualization in a new tab
  const openInNewTab = () => {
    const html = createVisualizationHTML();
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(html);
      newWindow.document.title = visualization.title;
      newWindow.document.close();
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{visualization.title}</h3>
        
        {visualization.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{visualization.description}</p>
        )}
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Created: {formatDate(visualization.createdAt)}</span>
          
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
              <h3 className="text-xl font-bold">{visualization.title}</h3>
              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4 bg-gray-50">
              <div 
                ref={fullscreenContainerRef}
                className="w-full h-full flex items-center justify-center"
              />
              
              {/* Error display */}
              {renderError && (
                <div className="text-red-500 p-4 text-center absolute bottom-20 left-0 right-0 bg-white bg-opacity-90">
                  {renderError}
                </div>
              )}
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