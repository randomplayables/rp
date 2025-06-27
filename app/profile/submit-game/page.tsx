"use client";

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/spinner';
import toast, { Toaster } from 'react-hot-toast';

interface IrlInstruction {
  title: string;
  url: string;
}

// Represents the data for a game already published by the user
interface UserGame {
    gameId: string;
    name: string;
    description?: string;
    year: number;
    image: string;
    version: string;
    codeUrl: string;
    link?: string;
    irlInstructions?: IrlInstruction[];
}

// Represents the data payload for a new submission
interface GameSubmissionData {
  name: string;
  description: string;
  year: number;
  image: string;
  version: string;
  codeUrl: string;
  irlInstructions: IrlInstruction[];
  submissionType: 'initial' | 'update';
  targetGameId?: string;
  previousVersion?: string;
}

interface SubmissionSuccessData {
  gameId: string;
  name: string;
  repoUrl: string;
}

async function submitGame(gameData: GameSubmissionData) {
  const response = await fetch('/api/games/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to submit game.');
  }

  return response.json();
}

async function fetchUserGames(username: string): Promise<UserGame[]> {
    if (!username) return [];
    const response = await fetch(`/api/games?authorUsername=${username}`);
    if (!response.ok) {
        throw new Error('Failed to fetch user games');
    }
    return response.json();
}

export default function SubmitGamePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  
  // Core Logic State
  const [submissionMode, setSubmissionMode] = useState<'initial' | 'update'>('initial');
  const [selectedGameForUpdate, setSelectedGameForUpdate] = useState<UserGame | null>(null);
  
  // Individual Form Field States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [image, setImage] = useState('');
  const [version, setVersion] = useState('');
  const [codeUrl, setCodeUrl] = useState('');
  const [irlInstructions, setIrlInstructions] = useState<IrlInstruction[]>([{ title: '', url: '' }]);
  
  // UI/Flow State
  const [submissionSuccessData, setSubmissionSuccessData] = useState<SubmissionSuccessData | null>(null);
  const [isConnectingRepo, setIsConnectingRepo] = useState(false);

  const { data: userGames, isLoading: isLoadingGames } = useQuery({
    queryKey: ['userGames', user?.username],
    queryFn: () => fetchUserGames(user!.username!),
    enabled: !!user?.username && submissionMode === 'update',
  });

  const mutation = useMutation({
    mutationFn: (data: GameSubmissionData) => submitGame(data),
    onSuccess: (data) => {
      toast.success('Game submitted for review successfully!');
      if (data.submission.submissionType === 'update') {
        toast.success("Your game update will be reviewed by an admin.");
        setTimeout(() => router.push(`/profile/${user?.username}`), 2000);
      } else {
        setSubmissionSuccessData({
          gameId: data.submission._id, 
          name: data.submission.name,
          repoUrl: data.submission.codeUrl,
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setYear(new Date().getFullYear());
    setImage('');
    setVersion('');
    setCodeUrl('');
    setIrlInstructions([{ title: '', url: '' }]);
    setSelectedGameForUpdate(null);
  };
  
  const handleModeChange = (mode: 'initial' | 'update') => {
    setSubmissionMode(mode);
    resetForm();
  };

  const handleGameSelectToUpdate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedGameId = e.target.value;
    const gameToUpdate = userGames?.find(g => g.gameId === selectedGameId);
    setSelectedGameForUpdate(gameToUpdate || null);

    if (gameToUpdate) {
        setName(gameToUpdate.name);
        setDescription(gameToUpdate.description || '');
        setYear(gameToUpdate.year);
        setImage(gameToUpdate.image);
        setVersion(''); // Clear version for user to enter new one
        setCodeUrl(gameToUpdate.codeUrl);
        setIrlInstructions(gameToUpdate.irlInstructions && gameToUpdate.irlInstructions.length > 0 ? gameToUpdate.irlInstructions : [{ title: '', url: '' }]);
    } else {
        resetForm();
    }
  };

  const handleInstructionChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const { name: fieldName, value } = e.target;
    const newInstructions = [...irlInstructions];
    const instructionToUpdate = { ...newInstructions[index] };
    
    if (fieldName === 'title' || fieldName === 'url') {
      instructionToUpdate[fieldName] = value;
    }
    
    newInstructions[index] = instructionToUpdate;
    setIrlInstructions(newInstructions);
  };

  const addInstruction = () => setIrlInstructions([...irlInstructions, { title: '', url: '' }]);
  const removeInstruction = (index: number) => setIrlInstructions(irlInstructions.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submissionMode === 'update' && !selectedGameForUpdate) {
        toast.error("Please select a game to update from the dropdown.");
        return;
    }

    const payload: GameSubmissionData = {
        name, description, year, image, version, codeUrl, irlInstructions,
        submissionType: submissionMode,
        targetGameId: selectedGameForUpdate?.gameId,
        previousVersion: selectedGameForUpdate?.version,
    };
    mutation.mutate(payload);
  };

  const handleConnectRepo = async () => {
    if (!submissionSuccessData) return;
    setIsConnectingRepo(true);
    toast.loading('Preparing GitHub connection...');
    try {
      const response = await fetch('/api/github/connect-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: submissionSuccessData.gameId, repoUrl: submissionSuccessData.repoUrl }),
      });
      const data = await response.json();
      toast.dismiss();
      if (data.success && data.installationUrl) {
        window.location.href = data.installationUrl;
      } else {
        toast.error(data.error || 'Could not initiate GitHub connection.');
      }
    } catch (error) {
      toast.dismiss();
      toast.error('An error occurred while connecting to GitHub.');
    } finally {
      setIsConnectingRepo(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner /><span className="ml-2">Loading...</span></div>;
  }

  if (submissionSuccessData) {
    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Toaster position="top-center" />
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Submission Received!</h1>
                <p className="text-gray-600 mb-6">Your game, "{submissionSuccessData.name}", is now pending review.</p>
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-lg">
                    <h2 className="text-xl font-bold text-emerald-700 mb-3">Final Step: Enable Peer Review</h2>
                    <p className="text-gray-600 mb-4">
                        To be eligible for inclusion on the platform, you must connect your GitHub repository. This allows other developers to submit peer reviews (pull requests).
                    </p>
                    <button onClick={handleConnectRepo} disabled={isConnectingRepo} className="w-full px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 flex items-center justify-center">
                        {isConnectingRepo && <Spinner className="w-5 h-5 mr-2" />}
                        {isConnectingRepo ? 'Connecting...' : 'Connect GitHub Repository'}
                    </button>
                </div>
                 <button onClick={() => router.push(`/profile/${user?.username}`)} className="mt-6 text-sm text-gray-600 hover:underline">
                    Go to Profile
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Toaster position="top-center" />
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Submit a Game for Review</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
            <div className="flex border-b">
                <button onClick={() => handleModeChange('initial')} className={`py-2 px-4 text-sm font-medium ${submissionMode === 'initial' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}>Submit New Game</button>
                <button onClick={() => handleModeChange('update')} className={`py-2 px-4 text-sm font-medium ${submissionMode === 'update' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}>Update Existing Game</button>
            </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {submissionMode === 'update' && (
            <div>
                <label htmlFor="game-select" className="block text-sm font-medium text-gray-700">Select Game to Update</label>
                {isLoadingGames ? <Spinner/> : (
                    <select id="game-select" onChange={handleGameSelectToUpdate} defaultValue="" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500">
                        <option value="" disabled>-- Choose a game --</option>
                        {userGames?.map(game => (
                            <option key={game.gameId} value={game.gameId}>{game.name} (v{game.version})</option>
                        ))}
                    </select>
                )}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Game Name</label>
            <input type="text" name="name" id="name" required value={name} onChange={(e) => setName(e.target.value)} disabled={submissionMode === 'update'} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100" />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea name="description" id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year</label>
              <input type="number" name="year" id="year" required value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700">New Version</label>
              <input type="text" name="version" id="version" required placeholder="e.g., 1.1.0" value={version} onChange={(e) => setVersion(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 font-bold" />
              {submissionMode === 'update' && selectedGameForUpdate && <p className="text-xs text-gray-500 mt-1">Previous version: {selectedGameForUpdate.version}</p>}
            </div>
          </div>
          
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700">Image URL</label>
            <input type="url" name="image" id="image" required placeholder="https://example.com/image.jpg" value={image} onChange={(e) => setImage(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          
          <div>
            <label htmlFor="codeUrl" className="block text-sm font-medium text-gray-700">Source Code URL</label>
            <input type="url" name="codeUrl" id="codeUrl" required readOnly={submissionMode === 'update'} placeholder="https://github.com/user/repo" value={codeUrl} onChange={(e) => setCodeUrl(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100" />
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">IRL Instructions</h3>
            {irlInstructions.map((inst, index) => (
              <div key={index} className="flex items-center gap-4 mb-3 p-3 border rounded-md bg-gray-50">
                <input type="text" name="title" placeholder="Instruction Title" value={inst.title} onChange={(e) => handleInstructionChange(index, e)} className="block w-1/2 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500" />
                <input type="url" name="url" placeholder="Instruction URL" value={inst.url} onChange={(e) => handleInstructionChange(index, e)} className="block w-1/2 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500" />
                <button type="button" onClick={() => removeInstruction(index)} className="text-red-500 hover:text-red-700 font-semibold" disabled={irlInstructions.length <= 1}> X </button>
              </div>
            ))}
            <button type="button" onClick={addInstruction} className="text-sm text-emerald-600 hover:text-emerald-700"> + Add Another Instruction </button>
          </div>
          
          <div className="flex justify-end pt-4 border-t">
            <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 flex items-center">
              {mutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
              {mutation.isPending ? 'Submitting...' : 'Submit Game for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}