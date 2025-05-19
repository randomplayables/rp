"use client"

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function UsageDisplay() {
  const { isLoaded, isSignedIn } = useUser();
  const [usage, setUsage] = useState<{ usageCount: number; monthlyLimit: number; remaining: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetch("/api/usage")
        .then(res => res.json())
        .then(data => {
          setUsage(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching usage data:", err);
          setLoading(false);
        });
    }
  }, [isLoaded, isSignedIn]);

  if (loading) {
    return <div>Loading usage data...</div>;
  }

  if (!usage) {
    return <div>No usage data available</div>;
  }

  const percentUsed = Math.min(100, Math.round((usage.usageCount / usage.monthlyLimit) * 100));

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-xl font-semibold mb-4">AI API Usage</h3>
      
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium">{usage.usageCount} / {usage.monthlyLimit} requests used</span>
          <span className="text-sm font-medium">{percentUsed}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${percentUsed > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} 
            style={{ width: `${percentUsed}%` }}
          ></div>
        </div>
      </div>
      
      <p className="text-sm text-gray-600">
        You have <span className="font-semibold">{usage.remaining}</span> AI requests remaining this month.
        {usage.remaining < 20 && (
          <span className="text-red-500 ml-1">Consider upgrading your plan for more requests.</span>
        )}
      </p>
    </div>
  );
}