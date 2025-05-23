"use client"

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';

interface Props {
  gameTitle: string;
  gameCode: string;
  gameDescription?: string;
}

interface GitHubStatus {
  connected: boolean;
  githubUsername?: string;
}

export default function GitHubUploadButton({ gameTitle, gameCode, gameDescription }: Props) {
  const { isSignedIn } = useUser();
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>({ connected: false });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ repositoryUrl: string; repositoryName: string } | null>(null);

  // Check GitHub connection status
  useEffect(() => {
    if (isSignedIn) {
      checkGitHubStatus();
    }
  }, [isSignedIn]);

  const checkGitHubStatus = async () => {
    try {
      const response = await fetch('/api/github/status');
      const data = await response.json();
      setGitHubStatus(data);
    } catch (error) {
      console.error('Error checking GitHub status:', error);
    }
  };

  const connectGitHub = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/github/auth');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error || 'Failed to connect to GitHub');
      }
    } catch (error) {
      setError('Failed to connect to GitHub');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectGitHub = async () => {
    try {
      await fetch('/api/github/status', { method: 'DELETE' });
      setGitHubStatus({ connected: false });
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
    }
  };

  const uploadToGitHub = async () => {
    if (!repoName.trim()) {
      setError('Please enter a repository name');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/github/upload-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameTitle,
          gameDescription,
          gameCode,
          repoName: repoName.trim(),
          isPrivate,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult(data);
        setIsModalOpen(false);
        setRepoName('');
      } else {
        setError(data.error || 'Failed to upload to GitHub');
      }
    } catch (error) {
      setError('An error occurred while uploading');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isSignedIn || !gameCode) {
    return null;
  }

  return (
    <>
      {!githubStatus.connected ? (
        <button
          onClick={connectGitHub}
          disabled={isConnecting}
          className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50 flex items-center"
        >
          {isConnecting && <Spinner className="w-4 h-4 mr-2" />}
          Connect GitHub
        </button>
      ) : (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Upload to GitHub
          </button>
          <span className="text-xs text-gray-500">
            Connected as {githubStatus.githubUsername}
          </span>
          <button
            onClick={disconnectGitHub}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Upload Game to GitHub</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repository Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-awesome-game"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Repository will be created as: {githubStatus.githubUsername}/{repoName || 'repository-name'}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Make repository private</span>
              </label>
            </div>
            
            {error && (
              <div className="mb-4 text-red-500 text-sm">{error}</div>
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              
              <button
                onClick={uploadToGitHub}
                disabled={isUploading}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center"
              >
                {isUploading && <Spinner className="w-4 h-4 mr-2" />}
                {isUploading ? 'Uploading...' : 'Upload to GitHub'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success notification */}
      {uploadResult && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Successfully uploaded to GitHub!</p>
              <a 
                href={uploadResult.repositoryUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:text-green-800 underline"
              >
                View repository: {uploadResult.repositoryName}
              </a>
            </div>
          </div>
          <button
            onClick={() => setUploadResult(null)}
            className="absolute top-2 right-2 text-green-500 hover:text-green-700"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}