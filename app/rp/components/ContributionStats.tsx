"use client"

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// Ensure this interface matches the one in models/RandomPayables.ts, especially metrics
interface ContributionMetrics {
  codeContributions: number;
  contentCreation: number;
  communityEngagement: number;
  githubRepoPoints: number;
  gamePublicationPoints: number;
  totalPoints: number; // This represents Points_OtherCategory
  peerReviewPoints: number;
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

  const fetchContributionData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let url = '/api/rp/contribution';
      const queryParams = new URLSearchParams();
      if (userId) {
        queryParams.append("userId", userId);
      } else if (username) {
        queryParams.append("username", username);
      }
      
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.emptyData) {
          setContribution(null);
          setError("No contribution data found yet. Start contributing to see your stats!");
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch contribution data');
      }
      
      const data = await response.json();
      setContribution(data.userContribution);
    } catch (err) {
      console.error('Error fetching contribution data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setContribution(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchContributionData(); 
  };
  
  useEffect(() => {
    if (isLoaded || userId || username) {
      fetchContributionData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, username, user?.id]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Your Contribution Stats</h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
        >
          {isRefreshing || isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {isLoading && !isRefreshing ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="font-semibold text-gray-700">Notice</p>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      ) : contribution ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-sky-50 p-4 rounded-lg border border-sky-100">
              <div className="text-sm text-sky-800">GitHub Platform Points</div>
              <div className="text-2xl font-bold text-sky-700">
                {(contribution.metrics.githubRepoPoints || 0).toFixed(2)}
              </div>
              <p className="text-xs text-sky-600">From commits to the main repo</p>
            </div>
             <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <div className="text-sm text-purple-800">Peer Review Points</div>
              <div className="text-2xl font-bold text-purple-700">
                {(contribution.metrics.peerReviewPoints || 0).toFixed(2)}
              </div>
              <p className="text-xs text-purple-600">From merged PR reviews</p>
            </div>
          </div>

           <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
              <div className="text-sm text-emerald-800">Other Category Points</div>
              <div className="text-2xl font-bold text-emerald-700">
                {(contribution.metrics.totalPoints || 0).toFixed(2)}
              </div>
              <p className="text-xs text-emerald-600">From all other contributions</p>
            </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Breakdown (Other Categories)</h4>
            <div className="space-y-3">
               <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Game Publications:</div>
                <div className="text-sm font-medium">{(contribution.metrics.gamePublicationPoints || 0)} points</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Code Contributions (Sketches):</div>
                <div className="text-sm font-medium">{(contribution.metrics.codeContributions || 0)} points</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Content Creation (Visualizations, Instruments):</div>
                <div className="text-sm font-medium">{(contribution.metrics.contentCreation || 0)} points</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm text-gray-600">Community Engagement (Stack Q&A):</div>
                <div className="text-sm font-medium">{(contribution.metrics.communityEngagement || 0)} points</div>
              </div>
            </div>
          </div>
           <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
              <div className="text-sm text-blue-800">Total Wins from Random Payables</div>
              <div className="text-2xl font-bold text-blue-700">${(contribution.winCount || 0)}</div>
            </div>
          
          <div className="text-xs text-gray-500">
            Metrics last updated: {contribution.lastCalculated ? formatDate(contribution.lastCalculated) : 'N/A'}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No contribution data available for this user.
        </div>
      )}
    </div>
  );
}