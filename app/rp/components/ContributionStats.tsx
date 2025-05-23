"use client"

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface ContributionMetrics {
  codeContributions: number;
  contentCreation: number;
  communityEngagement: number;
  bugReports: number;
  totalPoints: number;
}

interface UserContribution {
  userId: string;
  username: string;
  metrics: ContributionMetrics;
  winProbability: number;
  winCount: number;
  lastCalculated: string;
}

interface ContributionStatsProps {
  userId?: string;
  username?: string;
}

export default function ContributionStats({ userId, username }: ContributionStatsProps) {
  const { user, isLoaded } = useUser();
  const [contribution, setContribution] = useState<UserContribution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/rp/update-contributions', {
        method: 'POST'
      });
      
      if (response.ok) {
        // Reload the contribution data
        window.location.reload();
      } else {
        console.error('Failed to refresh contributions');
      }
    } catch (error) {
      console.error('Error refreshing contributions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Fetch contribution data
  useEffect(() => {
    const fetchContributionData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let url = '/api/rp/contribution';
        
        // If a specific user is requested, add the parameter
        if (userId) {
          url += `?userId=${userId}`;
        } else if (username) {
          url += `?username=${username}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json();
          
          // Handle the specific case of no data found differently
          if (errorData.emptyData) {
            // This is not a critical error, just set contribution to null
            setContribution(null);
            // Display a friendly message
            setError("No contribution data found yet");
            return;
          }
          
          // For other errors, throw
          throw new Error(errorData.error || 'Failed to fetch contribution data');
        }
        
        const data = await response.json();
        setContribution(data.userContribution);
      } catch (err) {
        console.error('Error fetching contribution data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only fetch if user is loaded or specific user is requested
    if (isLoaded || userId || username) {
      fetchContributionData();
    }
  }, [isLoaded, userId, username, user?.id]);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Contribution Stats</h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="bg-gray-50 p-4 rounded-lg">
          {error === "No contribution data found yet" ? (
            <div>
              <p className="font-semibold text-gray-700">Welcome to Random Payables!</p>
              <p className="mt-2 text-sm text-gray-600">
                Start contributing to RandomPlayables by creating games, visualizations, or participating in discussions
                to build up your contribution points.
              </p>
              <p className="mt-4 text-sm text-gray-600">
                No contribution data has been recorded yet. Your first contributions will appear here.
              </p>
            </div>
          ) : (
            <div className="text-red-600">{error}</div>
          )}
        </div>
      ) : contribution ? (
        <div className="space-y-6">
          {/* Metrics overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
              <div className="text-sm text-emerald-800">Total Points</div>
              <div className="text-2xl font-bold text-emerald-700">
                {contribution.metrics.totalPoints.toFixed(2)}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="text-sm text-blue-800">Total Wins</div>
              <div className="text-2xl font-bold text-blue-700">${contribution.winCount}</div>
            </div>
          </div>
          
          {/* Detailed metrics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Contribution Breakdown</h4>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Code Contributions:</div>
                <div className="text-sm font-medium">{contribution.metrics.codeContributions} points</div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Content Creation:</div>
                <div className="text-sm font-medium">{contribution.metrics.contentCreation} points</div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Community Engagement:</div>
                <div className="text-sm font-medium">{contribution.metrics.communityEngagement} points</div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Bug Reports:</div>
                <div className="text-sm font-medium">{contribution.metrics.bugReports} points</div>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            Last updated: {formatDate(contribution.lastCalculated)}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No contribution data available.
        </div>
      )}
    </div>
  );
}