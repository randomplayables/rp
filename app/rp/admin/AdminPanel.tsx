"use client"

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import PayoutExecutor from './PayoutExecutor';
import { isAdmin } from '@/lib/auth';
import { IPayoutConfigBase } from '@/models/RandomPayables';
import { Spinner } from '@/components/spinner';

interface Stats {
  totalContributors: number;
  totalPaidOut: number;
  currentPoolSize: number;
  topContributors: Array<{
    username: string;
    metrics: { 
        totalPoints: number; // This is "Other Category Points"
        githubRepoPoints?: number;
        peerReviewPoints?: number; // Added for the new column
    }; 
    winCount: number;
    winProbability?: number;
  }>;
  recentPayouts: Array<{
    username: string;
    amount: number;
    timestamp: string;
  }>;
}

export default function AdminPanel() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [config, setConfig] = useState<IPayoutConfigBase | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'execute' | 'settings'>('dashboard');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isUpdatingContributions, setIsUpdatingContributions] = useState(false);
  const [updateStatusMessage, setUpdateStatusMessage] = useState('');

  const isUserAdmin = isAdmin(user?.id, user?.username);

  const inputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm";

  const fetchAdminData = async () => {
    if (!isUserAdmin) return;

    setIsLoadingStats(true);
    try {
      const statsResponse = await fetch('/api/rp/stats');
      if (!statsResponse.ok) throw new Error('Failed to fetch stats');
      const statsData = await statsResponse.json();
      setStats(statsData.stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'An error occurred fetching stats');
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    const fetchInitialConfig = async () => {
      if (!isUserAdmin) return;
      setIsLoadingConfig(true);
      try {
        const configResponse = await fetch('/api/rp/config');
        if (!configResponse.ok) throw new Error('Failed to fetch configuration');
        const configData = await configResponse.json();
        setConfig(configData.config as IPayoutConfigBase);
      } catch (err) {
        console.error('Error fetching config:', err);
        setError(err instanceof Error ? err.message : 'An error occurred fetching config');
      } finally {
        setIsLoadingConfig(false);
      }
    };
    
    if (isLoaded && isSignedIn) {
      fetchInitialConfig();
      fetchAdminData();
    }
  }, [isLoaded, isSignedIn, isUserAdmin]);

  const handleRecalculateContributions = async () => {
    if (!confirm('This may be a long-running process. Are you sure you want to recalculate all user contributions?')) {
      return;
    }
    setIsUpdatingContributions(true);
    setUpdateStatusMessage('');
    setError(null);
    try {
      const response = await fetch('/api/rp/update-contributions', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update contributions.');
      }
      setUpdateStatusMessage(data.message || 'Contributions updated successfully!');
      // Refresh stats after update
      await fetchAdminData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during recalculation.';
      setError(errorMessage);
      setUpdateStatusMessage('');
    } finally {
      setIsUpdatingContributions(false);
    }
  };


  const handleConfigChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const typeAttribute = e.target.getAttribute('type');
    const isNumberInput = typeAttribute === 'number';

    const keys = name.split('.');

    setConfig(prevConfig => {
      if (!prevConfig) return null;
      const newConfig = JSON.parse(JSON.stringify(prevConfig)) as IPayoutConfigBase;
      
      const parsedValue = isNumberInput ? parseFloat(value) || 0 : value;

      let currentLevel: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!currentLevel[keys[i]] || typeof currentLevel[keys[i]] !== 'object') {
          currentLevel[keys[i]] = {};
        }
        currentLevel = currentLevel[keys[i]];
      }
      currentLevel[keys[keys.length - 1]] = parsedValue;
      
      return newConfig;
    });
  };
  
  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSavingConfig(true);
    setError(null);
    try {
      const response = await fetch('/api/rp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }
      const savedData = await response.json();
      setConfig(savedData.config as IPayoutConfigBase);
      alert('Configuration saved successfully!');
    } catch (err) {
      console.error('Error saving config:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred saving config';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const formatDate = (dateInput?: Date | string) => {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (!isLoaded) return <div className="flex justify-center items-center min-h-screen"><Spinner /> Loading authentication...</div>;
  if (!isSignedIn) return <div className="min-h-screen flex items-center justify-center"><p>Please sign in.</p></div>;
  if (!isUserAdmin && isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p>You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }
  
  const isLoading = isLoadingConfig || isLoadingStats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Random Payables Admin</h1>
        <p className="mt-2 text-lg text-gray-600">Manage and monitor the Random Payables system</p>
      </div>
      
      <div className="mb-8 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          {['dashboard', 'execute', 'settings'].map((tabName) => (
            <button
              key={tabName}
              onClick={() => setActiveTab(tabName as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tabName
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tabName}
            </button>
          ))}
        </nav>
      </div>
      
      {isLoading && !error ? (
        <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-6 rounded-lg mb-6">{error}</div>
      ) : (
        <div>
          {activeTab === 'dashboard' && stats && config && (
            <div className="space-y-8">
               <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Actions</h3>
                <div className="mt-4">
                    <button
                        onClick={handleRecalculateContributions}
                        disabled={isUpdatingContributions}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                    >
                        {isUpdatingContributions ? <Spinner className="inline w-4 h-4 mr-2" /> : null}
                        {isUpdatingContributions ? 'Recalculating...' : 'Recalculate All Contributions'}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                        Fetches latest GitHub activity and recalculates points for all users. This may take a few moments.
                    </p>
                    {updateStatusMessage && <p className="mt-2 text-sm text-green-600">{updateStatusMessage}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500">Total Contributors</h3>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.totalContributors}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500">Total Paid Out</h3>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">${stats.totalPaidOut.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500">Current Pool Size</h3>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">${config.totalPool.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-medium text-gray-900">Top Contributors</h3></div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Chance</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Other Cat. Points</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GH Repo Points</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peer Review Points</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Count</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.topContributors.map((c, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.winProbability !== undefined ? (c.winProbability * 100).toFixed(4) + '%' : 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.metrics.totalPoints !== undefined ? c.metrics.totalPoints.toFixed(2) : 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.metrics.githubRepoPoints?.toFixed(2) || '0.00'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.metrics.peerReviewPoints?.toFixed(2) || '0.00'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.winCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-medium text-gray-900">Recent Payouts</h3></div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.recentPayouts.map((p, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.amount.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(p.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'execute' && <PayoutExecutor />}
          
          {activeTab === 'settings' && config && (
            <form onSubmit={handleSaveConfig} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-6">
              <h2 className="text-xl font-medium text-gray-900 mb-6">System Configuration</h2>
              
              <div>
                <label htmlFor="totalPool" className="block text-sm font-medium text-gray-700">Total Pool Size ($)</label>
                <input type="number" name="totalPool" value={config.totalPool} onChange={handleConfigChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700">Default Batch Size ($ for payouts)</label>
                <input type="number" name="batchSize" value={config.batchSize} onChange={handleConfigChange} className={inputClass} />
              </div>

              <h3 className="text-md font-medium text-gray-700 pt-4 border-t">Top-Level Contribution Weights</h3>
              <p className="text-sm text-gray-600">These three weights determine the overall importance of each main category. They should sum to 1.0 for a 100% distribution.</p>
                <div>
                  <label htmlFor="topLevelWeights.githubPlatformWeight" className="block text-sm font-medium text-gray-700">GitHub Platform Weight (e.g., 0.4 for 40%)</label>
                  <input type="number" step="0.01" name="topLevelWeights.githubPlatformWeight" value={config.topLevelWeights?.githubPlatformWeight || 0} onChange={handleConfigChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="topLevelWeights.peerReviewWeight" className="block text-sm font-medium text-gray-700">Peer Review Weight (e.g., 0.4 for 40%)</label>
                  <input type="number" step="0.01" name="topLevelWeights.peerReviewWeight" value={config.topLevelWeights?.peerReviewWeight || 0} onChange={handleConfigChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="topLevelWeights.otherContributionsWeight" className="block text-sm font-medium text-gray-700">Other Contributions Weight (e.g., 0.2 for 20%)</label>
                  <input type="number" step="0.01" name="topLevelWeights.otherContributionsWeight" value={config.topLevelWeights?.otherContributionsWeight || 0} onChange={handleConfigChange} className={inputClass} />
                </div>

              <h3 className="text-md font-medium text-gray-700 pt-4 border-t">Sub-Weights for "Other Contributions" Bucket</h3>
                <div>
                  <label htmlFor="weights.gamePublicationWeight" className="block text-sm font-medium text-gray-700">Game Publication Weight</label>
                  <input type="number" step="0.01" name="weights.gamePublicationWeight" value={config.weights.gamePublicationWeight || 0} onChange={handleConfigChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="weights.communityWeight" className="block text-sm font-medium text-gray-700">Community Weight (Stack Q&A)</label>
                  <input type="number" step="0.01" name="weights.communityWeight" value={config.weights.communityWeight} onChange={handleConfigChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="weights.codeWeight" className="block text-sm font-medium text-gray-700">Code Weight (Sketches)</label>
                  <input type="number" step="0.01" name="weights.codeWeight" value={config.weights.codeWeight} onChange={handleConfigChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="weights.contentWeight" className="block text-sm font-medium text-gray-700">Content Weight (Viz, Instruments)</label>
                  <input type="number" step="0.01" name="weights.contentWeight" value={config.weights.contentWeight} onChange={handleConfigChange} className={inputClass} />
                </div>
              
              <h3 className="text-md font-medium text-gray-700 pt-4 border-t">GitHub Repository Settings</h3>
              <div>
                <label htmlFor="githubRepoDetails.owner" className="block text-sm font-medium text-gray-700">Repo Owner</label>
                <input type="text" name="githubRepoDetails.owner" value={config.githubRepoDetails?.owner || ''} onChange={handleConfigChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="githubRepoDetails.repo" className="block text-sm font-medium text-gray-700">Repo Name</label>
                <input type="text" name="githubRepoDetails.repo" value={config.githubRepoDetails?.repo || ''} onChange={handleConfigChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="githubRepoDetails.pointsPerCommit" className="block text-sm font-medium text-gray-700">Points Per Commit</label>
                <input type="number" name="githubRepoDetails.pointsPerCommit" value={config.githubRepoDetails?.pointsPerCommit || 0} onChange={handleConfigChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="githubRepoDetails.pointsPerLineChanged" className="block text-sm font-medium text-gray-700">Points Per Line Changed</label>
                <input type="number" step="0.01" name="githubRepoDetails.pointsPerLineChanged" value={config.githubRepoDetails?.pointsPerLineChanged || 0} onChange={handleConfigChange} className={inputClass} />
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">Last Updated: {formatDate(config.lastUpdated)}</p>
                <p className="text-sm text-gray-500">Next Scheduled Run: {formatDate(config.nextScheduledRun)}</p>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={isSavingConfig} className="bg-emerald-500 text-white py-2 px-4 rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50">
                  {isSavingConfig ? <Spinner className="inline w-4 h-4 mr-2"/> : null}
                  Save Configuration
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}