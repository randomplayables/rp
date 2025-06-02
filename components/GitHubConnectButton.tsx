"use client"

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';
import toast from 'react-hot-toast';

interface GitHubStatus {
  connected: boolean;
  githubUsername?: string;
}

export default function GitHubConnectButton() {
  const { isSignedIn, user } = useUser();
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>({ connected: false });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    } catch (err) {
      console.error('Error checking GitHub status:', err);
      setError(err instanceof Error ? err.message : 'Could not check GitHub status.');
      setGitHubStatus({ connected: false });
    } finally {
      setIsLoadingStatus(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    checkGitHubStatus();
  }, [checkGitHubStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('github_connected') === 'true') {
      toast.success('GitHub account connected successfully!');
      checkGitHubStatus();
      const newUrl = window.location.pathname; // Keep current path, remove query params
      window.history.replaceState({}, document.title, newUrl);
    } else if (params.get('error')) {
        const githubError = params.get('error');
        let friendlyMessage = 'Failed to connect GitHub account.';
        if (githubError === 'github_auth_failed') friendlyMessage = 'GitHub authorization failed. Please try again.';
        if (githubError === 'github_token_failed') friendlyMessage = `Could not retrieve GitHub token: ${params.get('error_description') || 'Please try again.'}`;
        if (githubError === 'github_user_fetch_failed') friendlyMessage = 'Could not fetch your GitHub user information. Please try again.';
        if (githubError === 'github_callback_failed') friendlyMessage = 'An error occurred during GitHub callback. Please try again.';
        if (githubError === 'github_auth_invalid_state') friendlyMessage = 'Invalid state during GitHub authorization. Please try again.';
        toast.error(friendlyMessage);
        setError(friendlyMessage);
        const newUrl = window.location.pathname; // Keep current path, remove query params
        window.history.replaceState({}, document.title, newUrl);
    }
  }, [checkGitHubStatus]);

  const handleConnectGitHub = async () => {
    setIsConnecting(true);
    setError(null);
    toast.loading('Redirecting to GitHub...');

    try {
      const response = await fetch('/api/github/auth?origin=/profile'); // MODIFIED: Pass origin
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.dismiss();
        const errMsg = data.error || 'Failed to get GitHub authentication URL. Subscription might be required.';
        setError(errMsg);
        toast.error(errMsg);
        setIsConnecting(false); // Reset connecting state on error before redirect
      }
    } catch (err) {
      toast.dismiss();
      const errMsg = err instanceof Error ? err.message : 'Failed to initiate GitHub connection.';
      console.error('GitHub connection error:', err);
      setError(errMsg);
      toast.error(errMsg);
      setIsConnecting(false); // Reset connecting state on error
    }
    // No finally setIsConnecting(false) here, as page will redirect on success
  };

  const handleDisconnectGitHub = async () => {
    if (!confirm("Are you sure you want to disconnect your GitHub account from RandomPlayables?")) return;

    setIsDisconnecting(true);
    setError(null);
    toast.loading('Disconnecting GitHub...');

    try {
      const response = await fetch('/api/github/status', { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to disconnect GitHub account.");
      }
      toast.dismiss();
      toast.success('GitHub account disconnected successfully.');
      setGitHubStatus({ connected: false });
    } catch (err) {
      toast.dismiss();
      const errMsg = err instanceof Error ? err.message : 'Failed to disconnect GitHub.';
      console.error('GitHub disconnect error:', err);
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (!isSignedIn) {
    return null;
  }

  if (isLoadingStatus) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <Spinner className="w-4 h-4 mr-2" />
        Checking GitHub Status...
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 text-gray-700">GitHub Account Integration</h3>
      {error && <p className="text-sm text-red-600 mb-3">Error: {error}</p>}
      {!githubStatus.connected ? (
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Connect your GitHub account to enable features like Random Payables for repository contributions and easy GameLab sketch uploads.
            An active subscription is required for GitHub integration.
          </p>
          <button
            onClick={handleConnectGitHub}
            disabled={isConnecting}
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center"
          >
            {isConnecting && <Spinner className="w-4 h-4 mr-2" />}
            {isConnecting ? 'Connecting...' : 'Connect GitHub Account'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-green-700 flex items-center">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.06 0l4-5.5Z" clipRule="evenodd" />
            </svg>
            Connected as: <strong className="ml-1">{githubStatus.githubUsername}</strong>
          </p>
          <button
            onClick={handleDisconnectGitHub}
            disabled={isDisconnecting}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 flex items-center"
          >
            {isDisconnecting && <Spinner className="w-4 h-4 mr-2" />}
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect GitHub'}
          </button>
        </div>
      )}
    </div>
  );
}