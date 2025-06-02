"use client"

import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useUser } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';
import toast from 'react-hot-toast'; // For user feedback, consistent with GitHubConnectButton

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GitHubStatus {
  connected: boolean;
  githubUsername?: string;
}

interface Props {
  gameTitle: string;
  gameCode: string;
  gameDescription?: string;
  currentLanguage: string;
  messages: ChatMessage[]; // Used for saving GameLab state
}

export default function GitHubUploadButton({ gameTitle, gameCode, gameDescription, currentLanguage, messages }: Props) {
  const { isSignedIn } = useUser(); // Removed 'user' as it's not directly used here
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>({ connected: false });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true); // New state for loading status
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ repositoryUrl: string; repositoryName: string } | null>(null);

  const checkGitHubStatus = useCallback(async () => {
    if (!isSignedIn) {
        setIsLoadingStatus(false);
        return;
    }
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/github/status');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to fetch GitHub status");
      }
      const data = await response.json();
      setGitHubStatus(data);
      setError(null); // Clear error on successful status check
    } catch (err) {
      console.error('Error checking GitHub status:', err);
      // Do not set generic error here, let connect button show if status is not connected
      setGitHubStatus({ connected: false });
    } finally {
        setIsLoadingStatus(false);
    }
  }, [isSignedIn]);


  useEffect(() => {
    checkGitHubStatus();
  }, [checkGitHubStatus]);


  const connectGitHub = async () => {
    setIsConnecting(true);
    setError(null);
    toast.loading('Redirecting to GitHub...');

    try {
      if (gameCode) {
        localStorage.setItem('gamelab_pending_code', gameCode);
        localStorage.setItem('gamelab_pending_language', currentLanguage);
        localStorage.setItem('gamelab_pending_messages', JSON.stringify(messages));
        localStorage.setItem('gamelab_restore_on_callback', 'true');
        console.log('GameLab state saved to localStorage.');
      }

      const response = await fetch('/api/github/auth?origin=/gamelab'); // MODIFIED: Pass origin
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.dismiss();
        const errMsg = data.error || 'Failed to connect to GitHub. Subscription might be required.';
        setError(errMsg);
        toast.error(errMsg);
        setIsConnecting(false);
        // Clear localStorage if auth URL fetch fails
        localStorage.removeItem('gamelab_restore_on_callback');
        localStorage.removeItem('gamelab_pending_code');
        localStorage.removeItem('gamelab_pending_language');
        localStorage.removeItem('gamelab_pending_messages');
      }
    } catch (err) {
      toast.dismiss();
      const errMsg = err instanceof Error ? err.message : 'Failed to initiate GitHub connection.';
      console.error('GitHub connection error:', err);
      setError(errMsg);
      toast.error(errMsg);
      setIsConnecting(false);
      localStorage.removeItem('gamelab_restore_on_callback');
      localStorage.removeItem('gamelab_pending_code');
      localStorage.removeItem('gamelab_pending_language');
      localStorage.removeItem('gamelab_pending_messages');
    }
    // No finally setIsConnecting(false) here, as page will redirect on success
  };

  const disconnectGitHub = async () => {
    if (!confirm("Are you sure you want to disconnect your GitHub account? This will not delete any repositories on GitHub.")) return;
    toast.loading("Disconnecting GitHub...");
    try {
      await fetch('/api/github/status', { method: 'DELETE' });
      toast.dismiss();
      toast.success('GitHub account disconnected.');
      setGitHubStatus({ connected: false });
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect GitHub.');
      console.error('Error disconnecting GitHub:', err);
    }
  };

  const handleUploadToGitHub = async () => { // Renamed to avoid conflict
    if (!repoName.trim()) {
      setError('Please enter a repository name');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResult(null);
    toast.loading("Uploading to GitHub...");

    try {
      const response = await fetch('/api/github/upload-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle,
          gameDescription,
          gameCode,
          repoName: repoName.trim(),
          isPrivate,
        }),
      });

      const data = await response.json();
      toast.dismiss();

      if (response.ok && data.success) {
        setUploadResult(data);
        setIsModalOpen(false);
        setRepoName('');
        setError(null);
        toast.success("Game uploaded to GitHub successfully!");
      } else {
        setError(data.error || 'Failed to upload to GitHub');
        toast.error(data.error || 'Failed to upload to GitHub');
      }
    } catch (err) {
      toast.dismiss();
      setError(err instanceof Error ? err.message : 'An error occurred while uploading');
      toast.error(err instanceof Error ? err.message : 'An error occurred while uploading');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isSignedIn) { 
    return null;
  }
  
  if (isLoadingStatus) {
    return (
      <button
        disabled={true}
        className="px-3 py-1 bg-gray-700 text-white rounded opacity-50 flex items-center"
      >
        <Spinner className="w-4 h-4 mr-2" />
        Loading GitHub Status...
      </button>
    );
  }

  return (
    <>
      {!githubStatus.connected ? (
        <button
          onClick={connectGitHub}
          disabled={isConnecting || !gameCode} 
          title={!gameCode ? "Create a game first to connect GitHub" : "Connect your GitHub account to upload this game"}
          className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50 flex items-center"
        >
          {isConnecting && <Spinner className="w-4 h-4 mr-2" />}
          Connect GitHub to Upload
        </button>
      ) : (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setError(null);
              setUploadResult(null);
              // Suggest a repo name based on gameTitle
              const suggestedRepoName = gameTitle
                ? gameTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                : `gamelab-sketch-${Date.now().toString().slice(-5)}`;
              setRepoName(suggestedRepoName);
              setIsModalOpen(true);
            }}
            disabled={!gameCode} 
            title={!gameCode ? "No game code to upload" : "Upload this game to your GitHub"}
            className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Upload to GitHub
          </button>
          <span className="text-xs text-gray-500 hidden md:inline">
            (as {githubStatus.githubUsername})
          </span>
          <button
            onClick={disconnectGitHub}
            className="text-xs text-red-500 hover:text-red-700"
            title="Disconnect GitHub account"
          >
            Disconnect
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Upload Game to GitHub</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repository Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, '-'))} // Replace spaces with hyphens
                placeholder="my-awesome-gamelab-sketch"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Repo: {githubStatus.githubUsername}/{repoName || 'repository-name'}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="mr-2 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Make repository private</span>
              </label>
            </div>
            
            {error && (
              <div className="mb-4 text-red-500 text-sm p-2 bg-red-50 rounded-md">{error}</div>
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
                type="button" 
                onClick={handleUploadToGitHub}
                disabled={isUploading || !repoName.trim()}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center"
              >
                {isUploading && <Spinner className="w-4 h-4 mr-2" />}
                {isUploading ? 'Uploading...' : 'Upload Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast is handled by GitHubConnectButton's useEffect now, this is for upload specific result */}
      {uploadResult && (
         <div className="fixed bottom-4 right-4 bg-green-100 border border-green-300 text-green-700 p-3 rounded-lg shadow-lg z-[100] text-sm"
            role="alert">
            <div className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2 flex-shrink-0">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.06 0l4-5.5Z" clipRule="evenodd" />
                </svg>
                <div>
                    <p className="font-medium">Game uploaded successfully!</p>
                    <a href={uploadResult.repositoryUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800">
                        View on GitHub: {uploadResult.repositoryName}
                    </a>
                </div>
                <button onClick={() => setUploadResult(null)} className="ml-4 -mt-1 -mr-1 text-green-600 hover:text-green-800" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                </button>
            </div>
        </div>
      )}
    </>
  );
}