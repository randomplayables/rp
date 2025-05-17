"use client"

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface ProbabilityIndicatorProps {
  username?: string;
  userId?: string;
}

export default function ProbabilityIndicator({ username, userId }: ProbabilityIndicatorProps) {
  const { user, isLoaded } = useUser();
  const [probability, setProbability] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch probability data on component mount
  useEffect(() => {
    const fetchProbability = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let url = '/api/rp/probability';
        
        // If a specific user is requested, add the parameter
        if (userId) {
          url += `?userId=${userId}`;
        } else if (username) {
          url += `?username=${username}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          // Special handling for new users with no data
          const errorData = await response.json();
          if (errorData.emptyData) {
            setProbability(0); // Set to zero for new users
            return;
          }
          
          throw new Error(errorData.error || 'Failed to fetch probability');
        }
        
        const data = await response.json();
        setProbability(data.probability);
      } catch (err) {
        console.error('Error fetching probability:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only fetch if user is loaded or specific user is requested
    if (isLoaded || userId || username) {
      fetchProbability();
    }
  }, [isLoaded, userId, username, user?.id]);
  
  // Format probability as percentage
  const formattedProbability = probability !== null 
    ? `${(probability * 100).toFixed(4)}%` 
    : 'Unknown';
  
  // Calculate probability level for visual indicators
  const getProbabilityLevel = () => {
    if (probability === null) return 'unknown';
    if (probability >= 0.10) return 'very-high';
    if (probability >= 0.05) return 'high';
    if (probability >= 0.01) return 'medium';
    if (probability > 0) return 'low';
    return 'none';
  };
  
  const probabilityLevel = getProbabilityLevel();
  
  // Helper for level-based styling
  const getLevelColor = () => {
    switch (probabilityLevel) {
      case 'very-high': return 'bg-emerald-500';
      case 'high': return 'bg-emerald-400';
      case 'medium': return 'bg-blue-400';
      case 'low': return 'bg-blue-300';
      case 'none': return 'bg-gray-300';
      case 'unknown': return 'bg-gray-200';
      default: return 'bg-gray-200';
    }
  };
  
  const getLevelLabel = () => {
    switch (probabilityLevel) {
      case 'very-high': return 'Very High';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      case 'none': return 'None';
      case 'unknown': return 'Unknown';
      default: return 'Unknown';
    }
  };
  
  const indicatorColor = getLevelColor();
  const indicatorLabel = getLevelLabel();
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-2">Win Probability</h3>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-2">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Chance of winning next $1:</span>
            <span className="text-2xl font-bold">{formattedProbability}</span>
          </div>
          
          <div className="bg-gray-100 rounded-full h-4 w-full overflow-hidden">
            <div 
              className={`h-full ${indicatorColor} transition-all duration-500 ease-out`}
              style={{ width: probability !== null ? `${Math.min(probability * 100 * 20, 100)}%` : '0%' }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>Probability Level:</span>
            <span className="font-medium">{indicatorLabel}</span>
          </div>
          
          <p className="text-sm text-gray-600 mt-4">
            This probability is calculated based on your contributions to RandomPlayables.
            The more you contribute, the higher your chance of winning.
          </p>
        </div>
      )}
    </div>
  );
}