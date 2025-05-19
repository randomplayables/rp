"use client"

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import PayoutExecutor from './PayoutExecutor';
import { isAdmin } from '@/lib/auth';

interface Config {
  totalPool: number;
  batchSize: number;
  weights: {
    codeWeight: number;
    contentWeight: number;
    communityWeight: number;
    bugReportWeight: number;
  };
  lastUpdated: string;
  nextScheduledRun: string;
}

interface Stats {
  totalContributors: number;
  totalPaidOut: number;
  currentPoolSize: number;
  topContributors: Array<{
    username: string;
    metrics: { totalPoints: number };
    winCount: number;
  }>;
  recentPayouts: Array<{
    username: string;
    amount: number;
    timestamp: string;
  }>;
}

export default function AdminPanel() {

  const { isLoaded, isSignedIn, user } = useUser();
  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'execute' | 'settings'>('dashboard');
  
  // Replace this line with proper admin check
  const isAuthorized = isAdmin(user?.id, user?.username);
  
  
  // Fetch stats data
  useEffect(() => {
    const fetchStatsData = async () => {
      if (!isSignedIn) return;
      
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/rp/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        
        const data = await response.json();
        setStats(data.stats);
        
        // For the demo, we're just setting some example config
        // In a real implementation, this would come from an API
        setConfig({
          totalPool: data.stats.currentPoolSize || 10000,
          batchSize: 100,
          weights: {
            codeWeight: 1.0,
            contentWeight: 0.8,
            communityWeight: 0.5,
            bugReportWeight: 0.3
          },
          lastUpdated: new Date().toISOString(),
          nextScheduledRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isLoaded && isSignedIn) {
      fetchStatsData();
    }
  }, [isLoaded, isSignedIn]);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  if (!isLoaded) {
    return <div>Loading authentication...</div>;
  }
  
  if (isLoaded && !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p>You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Random Payables Admin</h1>
        <p className="mt-2 text-lg text-gray-600">
          Manage and monitor the Random Payables system
        </p>
      </div>
      
      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'dashboard'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard
          </button>
          
          <button
            onClick={() => setActiveTab('execute')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'execute'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Execute Payout
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settings
          </button>
        </nav>
      </div>
      
      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-6 rounded-lg mb-6">
          {error}
        </div>
      ) : (
        <div>
          {/* Dashboard tab */}
          {activeTab === 'dashboard' && stats && (
            <div className="space-y-8">
              {/* Stats cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500">Total Contributors</h3>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.totalContributors}</p>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500">Total Paid Out</h3>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">${stats.totalPaidOut}</p>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500">Current Pool Size</h3>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">${stats.currentPoolSize}</p>
                </div>
              </div>
              
              {/* Top contributors */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Contributors</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Points
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Win Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.topContributors.map((contributor, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {contributor.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {contributor.metrics.totalPoints.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {contributor.winCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Recent payouts */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Payouts</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.recentPayouts.map((payout, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {payout.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${payout.amount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(payout.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Execute payout tab */}
          {activeTab === 'execute' && (
            <PayoutExecutor />
          )}
          
          {/* Settings tab */}
          {activeTab === 'settings' && config && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-medium text-gray-900 mb-6">System Configuration</h2>
              
              <form className="space-y-6">
                <div>
                  <label htmlFor="totalPool" className="block text-sm font-medium text-gray-700">
                    Total Pool Size ($)
                  </label>
                  <input
                    type="number"
                    id="totalPool"
                    name="totalPool"
                    value={config.totalPool}
                    onChange={(e) => setConfig({...config, totalPool: parseInt(e.target.value) || 0})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700">
                    Default Batch Size
                  </label>
                  <input
                    type="number"
                    id="batchSize"
                    name="batchSize"
                    value={config.batchSize}
                    onChange={(e) => setConfig({...config, batchSize: parseInt(e.target.value) || 0})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Contribution Weights</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="codeWeight" className="block text-sm font-medium text-gray-700">
                        Code Contributions
                      </label>
                      <input
                        type="number"
                        id="codeWeight"
                        name="codeWeight"
                        step="0.1"
                        value={config.weights.codeWeight}
                        onChange={(e) => setConfig({
                          ...config, 
                          weights: {
                            ...config.weights,
                            codeWeight: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="contentWeight" className="block text-sm font-medium text-gray-700">
                        Content Creation
                      </label>
                      <input
                        type="number"
                        id="contentWeight"
                        name="contentWeight"
                        step="0.1"
                        value={config.weights.contentWeight}
                        onChange={(e) => setConfig({
                          ...config, 
                          weights: {
                            ...config.weights,
                            contentWeight: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="communityWeight" className="block text-sm font-medium text-gray-700">
                        Community Engagement
                      </label>
                      <input
                        type="number"
                        id="communityWeight"
                        name="communityWeight"
                        step="0.1"
                        value={config.weights.communityWeight}
                        onChange={(e) => setConfig({
                          ...config, 
                          weights: {
                            ...config.weights,
                            communityWeight: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="bugReportWeight" className="block text-sm font-medium text-gray-700">
                        Bug Reports
                      </label>
                      <input
                        type="number"
                        id="bugReportWeight"
                        name="bugReportWeight"
                        step="0.1"
                        value={config.weights.bugReportWeight}
                        onChange={(e) => setConfig({
                          ...config, 
                          weights: {
                            ...config.weights,
                            bugReportWeight: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="bg-emerald-500 text-white py-2 px-4 rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    Save Configuration
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}