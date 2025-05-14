"use client"

import { useState, useRef, useEffect } from 'react';
import { Spinner } from '@/components/spinner';
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
  const [isRendering, setIsRendering] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  
  // Use useEffect to run d3 visualization after the component mounts
  useEffect(() => {
    if (isPreviewMode && containerRef.current && !isRendering) {
      try {
        console.log('Running d3 visualization on container element');
        const container = containerRef.current;
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
    }
  }, [isPreviewMode, isRendering, visualization.code]);
  
  const togglePreview = () => {
    if (!isPreviewMode) {
      // Show preview
      setIsRendering(true);
      setIsPreviewMode(true);
      
      // When we turn on preview mode, the useEffect will handle rendering
      // Wait a short time to show the loading spinner
      setTimeout(() => {
        setIsRendering(false);
      }, 300);
    } else {
      // Hide preview
      setIsPreviewMode(false);
      setRenderError(null);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Preview area - conditionally rendered */}
      {isPreviewMode ? (
        <div className="p-4 bg-gray-50 h-60 overflow-hidden">
          {isRendering ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
              <span className="ml-2">Rendering...</span>
            </div>
          ) : (
            <>
              {/* Container for visualization - uses ref instead of id */}
              <div 
                ref={containerRef}
                className="w-full h-full flex items-center justify-center"
              />
              
              {/* Error display */}
              {renderError && (
                <div className="text-red-500 p-4 text-center">
                  {renderError}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="h-60 bg-gray-100 flex items-center justify-center">
          {visualization.previewImage ? (
            <img 
              src={visualization.previewImage} 
              alt={visualization.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          )}
        </div>
      )}
      
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
              onClick={togglePreview}
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