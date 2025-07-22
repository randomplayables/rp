"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/spinner';
import { IGauntletChallenge as GauntletChallengeType } from '@/models/Gauntlet'; // Renamed to avoid conflict

// Add _id to the local interface definition
interface IGauntletChallenge extends GauntletChallengeType {
  _id: string;
}

async function fetchOpenChallenges(): Promise<{ challenges: IGauntletChallenge[] }> {
  const response = await fetch('/api/gauntlet/challenges');
  if (!response.ok) {
    throw new Error('Failed to fetch challenges');
  }
  return response.json();
}

export default function GauntletPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gauntletChallenges'],
    queryFn: fetchOpenChallenges,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Open Gauntlet Challenges</h1>
        <Link href="/gauntlet/create" className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600">
          Create Challenge
        </Link>
      </div>

      {isLoading && <div className="text-center"><Spinner /></div>}
      {error && <p className="text-red-500">Error loading challenges: {error.message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.challenges.map((challenge) => (
          <Link key={challenge._id as string} href={`/gauntlet/${challenge._id}`} className="block bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-bold mb-2">{challenge.gameId.toUpperCase()} Challenge</h2>
            <p className="text-sm text-gray-500">Challenger: {challenge.challenger.username}</p>
            <div className="mt-4 flex justify-between">
              <div>
                <p className="text-xs text-gray-500">Your Wager</p>
                <p className="font-semibold">{challenge.opponentWager} points</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Their Wager</p>
                <p className="font-semibold">{challenge.challenger.wager} points</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}