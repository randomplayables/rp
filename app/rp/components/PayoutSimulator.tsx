// app/rp/components/PayoutSimulator.tsx
"use client"

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

interface SimulationResult {
  userId: string;
  username: string;
  dollars: number;
}

export default function PayoutSimulator() {
  const { isLoaded, isSignedIn } = useUser();
  const [amount, setAmount] = useState<number>(100);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Function to run the simulation
  const runSimulation = async () => {
    if (!isSignedIn) {
      setError('You must be signed in to run simulations');
      return;
    }
    
    if (amount < 1 || amount > 10000) {
      setError('Please enter an amount between 1 and 10,000');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);
      
      const response = await fetch('/api/rp/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run simulation');
      }
      
      const data = await response.json();
      setResults(data.results);
      setIsSuccess(true);
    } catch (err) {
      console.error('Error running simulation:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to determine if we show a placeholder or real results
  const showResults = results.length > 0;
  
  // Calculate total distributions for stats
  const totalDistributed = results.reduce((sum, result) => sum + result.dollars, 0);
  const uniqueRecipients = results.filter(result => result.dollars > 0).length;
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <h3 className="text-xl font-semibold mb-4">Payout Simulator</h3>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Number of Dollars to Distribute
        </label>
        <div className="flex space-x-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            min="1"
            max="10000"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={runSimulation}
            disabled={isLoading || !isSignedIn}
            className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50"
          >
            {isLoading ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
      
      {/* Stats cards */}
      {showResults && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
            <div className="text-sm text-emerald-800">Total Distributed</div>
            <div className="text-2xl font-bold text-emerald-700">${totalDistributed}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-800">Unique Recipients</div>
            <div className="text-2xl font-bold text-blue-700">{uniqueRecipients}</div>
          </div>
        </div>
      )}
      
      {/* Results table */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-3 bg-gray-100 px-4 py-2 font-medium text-gray-700 border-b border-gray-200">
          <div>Username</div>
          <div className="text-right">Dollars</div>
          <div className="text-right">Percentage</div>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : showResults ? (
            results.filter(result => result.dollars > 0).map((result, idx) => (
              <div 
                key={result.userId}
                className={`grid grid-cols-3 px-4 py-2 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className="truncate">{result.username}</div>
                <div className="text-right">${result.dollars.toFixed(2)}</div>
                <div className="text-right">
                  {totalDistributed > 0 
                    ? ((result.dollars / totalDistributed) * 100).toFixed(2) 
                    : '0.00'}%
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              Run a simulation to see how dollars would be distributed based on current probabilities.
            </div>
          )}
        </div>
      </div>
      
      {showResults && (
        <p className="mt-4 text-sm text-gray-600">
          This simulation shows how dollars would be distributed based on each user's current win probability.
          Actual results may vary due to the random nature of the distribution algorithm.
        </p>
      )}
    </div>
  );
}