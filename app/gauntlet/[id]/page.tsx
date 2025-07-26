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

async function cancelChallenge(id: string): Promise<any> {
    const response = await fetch(`/api/gauntlet/challenges/${id}/cancel`, {
        method: 'POST',
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel challenge.');
    }
    return data;
}

// New function for reporting abandonment
async function reportAbandonment(id: string): Promise<any> {
    const response = await fetch(`/api/gauntlet/challenges/${id}/abandon`, {
        method: 'POST',
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to report abandonment.');
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

const GRACE_PERIOD_MS = 60 * 60 * 1000; // 60 minutes

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
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['gauntletChallenge', id],
        queryFn: () => fetchChallenge(id!),
        enabled: !!id,
        refetchInterval: (query) => {
            const status = query.state.data?.challenge.status;
            // Refetch every 5 seconds if in progress to check for completion, or if started to check grace period
            return status === 'in_progress' || (status === 'active' && query.state.data?.challenge.startedAt) ? 5000 : false;
        },
    });

    const { data: games, isLoading: isLoadingGames } = useQuery({
        queryKey: ['allGames'],
        queryFn: fetchGames,
    });
    
    // Timer effect for grace period
    useEffect(() => {
        const challenge = data?.challenge;
        if (challenge?.status === 'in_progress' && challenge.startedAt) {
            const gracePeriodEnd = new Date(challenge.startedAt).getTime() + GRACE_PERIOD_MS;
            
            const updateTimer = () => {
                const now = Date.now();
                const remaining = gracePeriodEnd - now;
                setTimeRemaining(remaining > 0 ? remaining : 0);
            };
            
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        } else {
            setTimeRemaining(null);
        }
    }, [data?.challenge]);


    const acceptMutation = useMutation({
        mutationFn: (config: any) => acceptChallenge({ id: id!, opponentSetupConfig: config }),
        onSuccess: () => {
            toast.success('Challenge accepted! The game is now active.');
            refetch();
        },
        onError: (err: Error) => {
            toast.error(`Error: ${err.message}`);
        }
    });

    const cancelMutation = useMutation({
        mutationFn: () => cancelChallenge(id!),
        onSuccess: () => {
            toast.success('Challenge cancelled and wager refunded.');
            refetch(); // Refetch to update the status to 'cancelled'
        },
        onError: (err: Error) => {
            toast.error(`Error: ${err.message}`);
        }
    });

    const abandonMutation = useMutation({
        mutationFn: () => reportAbandonment(id!),
        onSuccess: (data) => {
            toast.success(data.message || 'Abandonment reported successfully!');
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
        toast.loading("Starting match...");
        
        try {
            const startResponse = await fetch(`/api/gauntlet/challenges/${id}/start`, { method: 'POST' });
            const startData = await startResponse.json();

            if (!startResponse.ok && startData.error) {
                throw new Error(startData.error);
            }
            
            await refetch();

            const gameForChallenge = games.find(g => g.gameId === data.challenge.gameId);
            if (!gameForChallenge) {
                throw new Error("Game data not found.");
            }

            const token = await getToken();
            let finalUrl = gameForChallenge.link;
            const separator = finalUrl.includes('?') ? '&' : '?';
            
            finalUrl += `${separator}gauntlet_mode=play&gauntletId=${id}`;
            finalUrl += `&authToken=${token}&userId=${user.id}&username=${encodeURIComponent(user.username || '')}`;
            finalUrl += `&challengerWager=${data.challenge.challenger.wager}&opponentWager=${data.challenge.opponentWager}`;

            
            toast.dismiss();
            window.open(finalUrl, '_blank');

        } catch (error: any) {
            toast.dismiss();
            toast.error(error.message || "Could not start the game.");
            console.error("Failed to start or launch game:", error);
        } finally {
            setIsLaunching(false);
        }
    };

    if (!id) return <div className="text-center p-10 text-red-500">Challenge ID not found in URL.</div>;
    if (isLoading || isLoadingGames) return <div className="text-center p-10"><Spinner /></div>;
    if (error) return <div className="text-center p-10 text-red-500">{error.message}</div>;

    const challenge = data?.challenge;
    const isPlayer = user?.id === challenge?.challenger.userId || user?.id === challenge?.opponent?.userId;
    const isStarter = user?.id === challenge?.startedByUserId;
    const gameForChallenge = games?.find(g => g.gameId === challenge?.gameId);

    const renderContent = () => {
        if (!challenge) return <p>Challenge could not be loaded.</p>;
        const isChallenger = user?.id === challenge.challenger.userId;

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
                            onClick={() => acceptMutation.mutate(opponentSetupConfig)}
                            disabled={!opponentSetupConfig || acceptMutation.isPending}
                            className="px-8 py-3 bg-emerald-500 text-white rounded-md text-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                        >
                            {acceptMutation.isPending ? 'Accepting...' : 'Accept Challenge'}
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
                        <div className="p-4 bg-gray-100 rounded-lg">
                           <p className="text-gray-600 mb-3">Waiting for an opponent to accept your challenge.</p>
                           <button
                                onClick={() => cancelMutation.mutate()}
                                disabled={cancelMutation.isPending}
                                className="px-6 py-2 bg-red-500 text-white rounded-md text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                           >
                               {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Challenge'}
                           </button>
                        </div>
                    )}
                    {challenge.status === 'active' && isPlayer && (
                        <button 
                            onClick={handlePlayGame}
                            disabled={isLaunching}
                            title="By clicking, you become the 'starter' and are responsible for the game's completion. If you abandon the match, your opponent may claim victory after a grace period."
                            className="inline-block px-8 py-3 bg-green-500 text-white rounded-md text-lg font-semibold hover:bg-green-600 disabled:opacity-50"
                        >
                            {isLaunching ? "Starting..." : "Play Game"}
                        </button>
                    )}
                    {challenge.status === 'in_progress' && isPlayer && !isStarter && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h3 className="text-lg font-medium text-yellow-800">Match in Progress</h3>
                            <p className="text-sm text-yellow-700 mt-2 mb-4">The game was started by {challenge.startedByUserId === challenge.challenger.userId ? challenge.challenger.username : challenge.opponent?.username}. If they have abandoned the match, you can report it after the grace period.</p>
                            <button
                                onClick={() => abandonMutation.mutate()}
                                disabled={abandonMutation.isPending || (timeRemaining !== null && timeRemaining > 0)}
                                className="px-6 py-2 bg-orange-500 text-white rounded-md text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
                            >
                                {abandonMutation.isPending ? 'Reporting...' : 'Report Abandonment'}
                            </button>
                            {timeRemaining !== null && timeRemaining > 0 && (
                                <p className="text-xs text-gray-500 mt-2">
                                    You can report in: {Math.ceil(timeRemaining / 60000)} minutes
                                </p>
                            )}
                        </div>
                    )}
                    {challenge.status === 'in_progress' && isStarter && (
                        <button 
                            disabled={true}
                            className="inline-block px-8 py-3 bg-yellow-500 text-white rounded-md text-lg font-semibold cursor-not-allowed"
                        >
                            Game in Progress
                        </button>
                    )}
                    {challenge.status === 'completed' && (
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <h3 className="text-xl font-bold text-gray-800">Game Over</h3>
                            <p className="mt-2 text-gray-700">
                                The winner is: <strong className="text-emerald-600">{challenge.winner === challenge.challenger.team ? challenge.challenger.username : challenge.opponent?.username}</strong>!
                            </p>
                        </div>
                    )}
                     {challenge.status === 'cancelled' && (
                        <div className="p-4 bg-red-50 border-red-200 border rounded-lg">
                            <h3 className="text-xl font-bold text-red-700">Challenge Cancelled</h3>
                            <p className="mt-2 text-gray-700">This challenge was cancelled by the creator.</p>
                        </div>
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