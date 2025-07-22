"use client";

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';
import { IGauntletChallenge } from '@/models/Gauntlet';
import { IGame } from '@/types/Game';
import toast, { Toaster } from 'react-hot-toast';

async function fetchChallenge(id: string): Promise<{ challenge: IGauntletChallenge }> {
    const response = await fetch(`/api/gauntlet/challenges/${id}`);
    if (!response.ok) {
        throw new Error('Challenge not found');
    }
    return response.json();
}

async function acceptChallenge(id: string): Promise<any> {
    const response = await fetch(`/api/gauntlet/challenges/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // We can pass the opponent's setup config here in the future
        body: JSON.stringify({}), 
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to accept challenge.');
    }
    return data;
}

// New function to fetch all games
async function fetchGames(): Promise<IGame[]> {
    const response = await fetch('/api/games');
    if (!response.ok) {
        throw new Error('Failed to fetch games');
    }
    return response.json();
}


export default function GauntletChallengePage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useUser();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const { data, isLoading, error } = useQuery({
        queryKey: ['gauntletChallenge', id],
        queryFn: () => fetchChallenge(id!),
        enabled: !!id,
    });

    // Fetch all games to find the link for the current challenge's game
    const { data: games, isLoading: isLoadingGames } = useQuery({
        queryKey: ['allGames'],
        queryFn: fetchGames,
    });

    const mutation = useMutation({
        mutationFn: () => acceptChallenge(id!),
        onSuccess: () => {
            toast.success('Challenge accepted! Starting game...');
            queryClient.invalidateQueries({ queryKey: ['gauntletChallenge', id] });
            // Later, we will redirect to the actual game play page
            // For now, let's just refresh the data.
        },
        onError: (err: Error) => {
            toast.error(`Error: ${err.message}`);
        }
    });

    if (!id) {
        return <div className="text-center p-10 text-red-500">Challenge ID not found in URL.</div>;
    }

    if (isLoading || isLoadingGames) return <div className="text-center p-10"><Spinner /></div>;
    if (error) return <div className="text-center p-10 text-red-500">{error.message}</div>;

    const challenge = data?.challenge;
    const isChallenger = user?.id === challenge?.challenger.userId;
    const gameForChallenge = games?.find(g => g.gameId === challenge?.gameId);

    const playGameUrl = gameForChallenge ? `${gameForChallenge.link}?gauntlet_mode=play&gauntletId=${id}` : '#';

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Toaster position="top-center" />
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">
                    {challenge?.gameId.toUpperCase()} Gauntlet Challenge
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Challenger</p>
                        <p className="text-xl font-bold">{challenge?.challenger.username}</p>
                        <p className="text-2xl font-bold text-emerald-600">{challenge?.challenger.wager} pts</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Opponent</p>
                        <p className="text-xl font-bold">{challenge?.opponent?.username || 'Waiting...'}</p>
                        <p className="text-2xl font-bold text-red-600">{challenge?.opponent?.wager} pts</p>
                    </div>
                </div>

                <div className="mt-6">
                    <h3 className="text-lg font-semibold">Challenger's Setup:</h3>
                    <pre className="bg-gray-800 text-white p-4 rounded-md mt-2 text-sm">
                        {JSON.stringify(challenge?.challenger.setupConfig, null, 2)}
                    </pre>
                </div>
                
                <div className="mt-8 text-center">
                    {challenge?.status === 'pending' && !isChallenger && (
                         <button 
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending}
                            className="px-8 py-3 bg-emerald-500 text-white rounded-md text-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                        >
                            {mutation.isPending ? 'Accepting...' : 'Accept Challenge'}
                        </button>
                    )}
                     {challenge?.status === 'pending' && isChallenger && (
                        <p className="text-gray-600">Waiting for an opponent to accept your challenge.</p>
                    )}
                     {challenge?.status === 'active' && (
                        <a 
                            href={playGameUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-8 py-3 bg-green-500 text-white rounded-md text-lg font-semibold hover:bg-green-600"
                        >
                            Play Game
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}