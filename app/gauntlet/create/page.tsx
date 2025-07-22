"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Spinner } from '@/components/spinner';
import { IGame } from '@/types/Game';
import toast, { Toaster } from 'react-hot-toast';

async function fetchGauntletGames(): Promise<IGame[]> {
    const response = await fetch('/api/games');
    if (!response.ok) {
        throw new Error('Failed to fetch games');
    }
    const allGames = await response.json();
    return allGames.filter((game: IGame) => game.isGauntlet);
}

async function createChallenge(payload: any) {
    const response = await fetch('/api/gauntlet/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to create challenge.');
    }
    return data;
}

export default function CreateGauntletPage() {
    const router = useRouter();
    const [selectedGame, setSelectedGame] = useState<IGame | null>(null);

    const { data: gauntletGames, isLoading, error } = useQuery({
        queryKey: ['gauntletGames'],
        queryFn: fetchGauntletGames,
    });
    
    const mutation = useMutation({
        mutationFn: createChallenge,
        onSuccess: (data) => {
            toast.success('Challenge created successfully! Redirecting...');
            router.push(`/gauntlet/${data.challenge._id}`);
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
        },
    });

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Add origin check for security
            if (!selectedGame || new URL(selectedGame.link).origin !== event.origin) {
                return;
            }

            if (event.data?.type === 'GAUNTLET_CHALLENGE_CREATE') {
                console.log('Received challenge config from iframe:', event.data.payload);
                mutation.mutate(event.data.payload);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [selectedGame, mutation]);

    if (selectedGame) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Toaster position="top-center" />
                <button onClick={() => setSelectedGame(null)} className="text-sm text-emerald-600 hover:underline mb-4">
                    &larr; Back to Game Selection
                </button>
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Create {selectedGame.name} Challenge</h1>
                <div className="w-full h-[80vh] border rounded-lg shadow-md">
                     <iframe
                        src={`${selectedGame.link}?gauntlet_mode=create`}
                        title={`${selectedGame.name} Gauntlet Setup`}
                        className="w-full h-full border-0"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Create a New Gauntlet</h1>
            <p className="text-gray-600 mb-8">Select a game to create a challenge for. You will set your wager and configure your side of the game for an opponent to accept.</p>
            
            {isLoading && <div className="text-center"><Spinner /></div>}
            {error && <p className="text-red-500 text-center">Error: {error.message}</p>}
            
            <div className="space-y-4">
                {gauntletGames && gauntletGames.length > 0 && gauntletGames.map((game) => (
                    <div key={game.gameId} className="bg-white p-6 rounded-lg shadow border border-gray-200">
                        <h2 className="text-xl font-bold text-emerald-600">{game.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">{game.description}</p>
                        <div className="mt-4">
                            <button 
                                onClick={() => setSelectedGame(game)}
                                className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600"
                            >
                                Create {game.name} Challenge
                            </button>
                        </div>
                    </div>
                ))}
                
                {gauntletGames && gauntletGames.length === 0 && (
                    <div className="bg-white p-6 rounded-lg shadow text-center">
                        <p className="text-gray-500">No Gauntlet-enabled games are available at the moment.</p>
                    </div>
                )}
            </div>
        </div>
    );
}