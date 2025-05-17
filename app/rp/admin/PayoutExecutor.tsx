// app/rp/admin/PayoutExecutor.tsx
"use client"

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

export default function PayoutExecutor() {
  const { isLoaded, isSignedIn } = useUser();
  const [amount, setAmount] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Execute a real payout
  const executePayout = async () => {
    if (!isSignedIn) {
      setError('You must be signed in as an admin to execute payouts');
      return;
    }
    
    if (amount < 1 || amount > 10000) {
      setError('Please enter an amount between 1 and 10,000');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/rp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute payout');
      }
      
      const data = await response.json();
      setSuccess(`Successfully executed payout of $${amount} with batch ID: ${data.batchId}`);
    } catch (err) {
      console.error('Error executing payout:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <h3 className="text-xl font-semibold mb-4">Execute Payout</h3>
      
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
        <h4 className="text-yellow-800 text-lg font-medium">Warning: Real Payout</h4>
        <p className="text-yellow-700 mt-1">
          This will execute a real payout, distributing actual funds to users. This action cannot be undone.
        </p>
      </div>
      
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
            onClick={executePayout}
            disabled={isLoading || !isSignedIn}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Execute Payout'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      </div>
      
      <div className="text-sm text-gray-600">
        <p>This action will:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Generate a unique batch ID for this payout run</li>
          <li>Distribute ${amount} from the payout pool</li>
          <li>Select winners based on their contribution probabilities</li>
          <li>Record all transactions in the database</li>
          <li>Update user win counts</li>
        </ul>
      </div>
    </div>
  );
}