"use client";

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser, useAuth } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';
import { IGauntletChallenge } from '@/models/Gauntlet';
import { IGame } from '@/types/Game';
import toast, { Toaster } from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';

async function fetchChallenge(id: string): Promise<{ challenge: IGauntletChallenge }> {
    const response = await fetch(`/api/gauntlet/challenges/${id}`);
    if (!response.ok) {
        throw new Error('Challenge not found');
    }
    return response.json();
}

async function acceptChallenge(payload: { id: string; opponentSetupConfig: any }): Promise<any> {
    const response = await fetch(`/api/gauntlet/challenges/${payload.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentSetupConfig: payload.opponentSetupConfig }), 
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to accept challenge.');
    }
    return data;
}

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
    const { getToken } = useAuth();
    const [isLaunching, setIsLaunching] = useState(false);
    const [opponentSetupConfig, setOpponentSetupConfig] = useState<any | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['gauntletChallenge', id],
        queryFn: () => fetchChallenge(id!),
        enabled: !!id,
    });

    const { data: games, isLoading: isLoadingGames } = useQuery({
        queryKey: ['allGames'],
        queryFn: fetchGames,
    });

    const mutation = useMutation({
        mutationFn: (config: any) => acceptChallenge({ id: id!, opponentSetupConfig: config }),
        onSuccess: () => {
            toast.success('Challenge accepted! The game is now active.');
            refetch();
        },
        onError: (err: Error) => {
            toast.error(`Error: ${err.message}`);
        }
    });

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const challenge = data?.challenge;
            if (!challenge || !iframeRef.current || event.source !== iframeRef.current.contentWindow) {
                return;
            }

            if (event.data?.type === 'GAUNTLET_OPPONENT_SETUP_READY') {
                iframeRef.current.contentWindow?.postMessage({
                    type: 'GAUNTLET_CHALLENGE_DATA',
                    payload: challenge
                }, '*');
            }

            if (event.data?.type === 'GAUNTLET_OPPONENT_SETUP_COMPLETE') {
                console.log("Received opponent setup config from iframe:", event.data.payload);
                setOpponentSetupConfig(event.data.payload);
                toast.success("Opponent setup complete. You can now accept the challenge.");
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [data?.challenge]);

    const handlePlayGame = async () => {
        if (!games || !data?.challenge || !user) return;
        
        setIsLaunching(true);
        toast.loading("Preparing game...");
        
        const gameForChallenge = games.find(g => g.gameId === data.challenge.gameId);
        if (!gameForChallenge) {
            toast.error("Game data not found.");
            setIsLaunching(false);
            return;
        }

        try {
            const token = await getToken();
            let finalUrl = gameForChallenge.link;
            const separator = finalUrl.includes('?') ? '&' : '?';
            
            finalUrl += `${separator}gauntlet_mode=play&gauntletId=${id}`;
            finalUrl += `&authToken=${token}&userId=${user.id}&username=${encodeURIComponent(user.username || '')}`;
            
            toast.dismiss();
            window.open(finalUrl, '_blank');
        } catch (error) {
            toast.error("Could not get authentication token. Please try again.");
            console.error("Failed to get auth token:", error);
        } finally {
            setIsLaunching(false);
        }
    };

    if (!id) return <div className="text-center p-10 text-red-500">Challenge ID not found in URL.</div>;
    if (isLoading || isLoadingGames) return <div className="text-center p-10"><Spinner /></div>;
    if (error) return <div className="text-center p-10 text-red-500">{error.message}</div>;

    const challenge = data?.challenge;
    const isChallenger = user?.id === challenge?.challenger.userId;
    const gameForChallenge = games?.find(g => g.gameId === challenge?.gameId);

    const renderContent = () => {
        if (!challenge) {
            return <p>Challenge could not be loaded.</p>;
        }

        if (challenge.status === 'pending' && !isChallenger && gameForChallenge) {
            return (
                <>
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold">Challenger's Setup (Locked):</h3>
                        <pre className="bg-gray-800 text-white p-4 rounded-md mt-2 text-sm max-h-40 overflow-auto">
                            {JSON.stringify(challenge.challenger.setupConfig, null, 2)}
                        </pre>
                    </div>
                    <div className="mt-4">
                        <h3 className="text-lg font-semibold">Your Setup (Team B):</h3>
                        <p className="text-sm text-gray-600 mb-2">Configure your side of the game below. Once finalized, you can accept the challenge.</p>
                        <div className="w-full h-[80vh] border rounded-lg shadow-md mb-4">
                            <iframe
                                ref={iframeRef}
                                src={`${gameForChallenge.link}?gauntlet_mode=accept&gauntletId=${id}`}
                                title={`${gameForChallenge.name} Opponent Setup`}
                                className="w-full h-full border-0"
                            />
                        </div>
                    </div>
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => mutation.mutate(opponentSetupConfig)}
                            disabled={!opponentSetupConfig || mutation.isPending}
                            className="px-8 py-3 bg-emerald-500 text-white rounded-md text-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                        >
                            {mutation.isPending ? 'Accepting...' : 'Accept Challenge'}
                        </button>
                    </div>
                </>
            );
        }

        return (
            <>
                 <div className="mt-6">
                    <h3 className="text-lg font-semibold">Challenger's Setup:</h3>
                    <pre className="bg-gray-800 text-white p-4 rounded-md mt-2 text-sm max-h-60 overflow-auto">
                        {JSON.stringify(challenge.challenger.setupConfig, null, 2)}
                    </pre>
                </div>
                {challenge.opponent?.setupConfig && (
                    <div className="mt-4">
                        <h3 className="text-lg font-semibold">Opponent's Setup:</h3>
                        <pre className="bg-gray-800 text-white p-4 rounded-md mt-2 text-sm max-h-60 overflow-auto">
                            {JSON.stringify(challenge.opponent.setupConfig, null, 2)}
                        </pre>
                    </div>
                )}
                <div className="mt-8 text-center">
                    {challenge.status === 'pending' && isChallenger && (
                        <p className="text-gray-600">Waiting for an opponent to accept your challenge.</p>
                    )}
                    {challenge.status === 'active' && (
                        <button 
                            onClick={handlePlayGame}
                            disabled={isLaunching}
                            className="inline-block px-8 py-3 bg-green-500 text-white rounded-md text-lg font-semibold hover:bg-green-600 disabled:opacity-50"
                        >
                            {isLaunching ? "Launching..." : "Play Game"}
                        </button>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Toaster position="top-center" />
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">
                    {challenge?.gameId.toUpperCase()} Gauntlet Challenge
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Challenger</p>
                        <p className="text-xl font-bold">{challenge?.challenger.username}</p>
                        <p className="text-2xl font-bold text-emerald-600">{challenge?.challenger.wager} pts</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Opponent</p>
                        <p className="text-xl font-bold">{challenge?.opponent?.username || 'Waiting...'}</p>
                        <p className="text-2xl font-bold text-red-600">{challenge?.opponent?.wager || challenge?.opponentWager} pts</p>
                    </div>
                </div>
                {renderContent()}
            </div>
        </div>
    );
}