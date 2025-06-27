"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/spinner';
import toast, { Toaster } from 'react-hot-toast';

interface IrlInstruction {
  title: string;
  url: string;
}

interface GameSubmissionData {
  name: string;
  description: string;
  year: number;
  image: string;
  version: string;
  codeUrl: string;
  irlInstructions: IrlInstruction[];
}

interface SubmissionSuccessData {
  gameId: string;
  name: string;
  repoUrl: string;
}

async function submitGame(gameData: GameSubmissionData) {
  const response = await fetch('/api/games/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gameData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to submit game.');
  }

  return response.json();
}

export default function SubmitGamePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [submissionSuccessData, setSubmissionSuccessData] = useState<SubmissionSuccessData | null>(null);
  const [isConnectingRepo, setIsConnectingRepo] = useState(false);

  const [formData, setFormData] = useState<GameSubmissionData>({
    name: '',
    description: '',
    year: new Date().getFullYear(),
    image: '',
    version: '',
    codeUrl: '',
    irlInstructions: [{ title: '', url: '' }],
  });

  const mutation = useMutation({
    mutationFn: submitGame,
    onSuccess: (data) => {
      toast.success('Game submitted for review successfully!');
      setSubmissionSuccessData({
        gameId: data.submission._id, 
        name: data.submission.name,
        repoUrl: data.submission.codeUrl,
      });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) || 0 : value,
    }));
  };

  const handleInstructionChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newInstructions = [...formData.irlInstructions];
    newInstructions[index] = { ...newInstructions[index], [name]: value };
    setFormData((prev) => ({
      ...prev,
      irlInstructions: newInstructions,
    }));
  };

  const addInstruction = () => {
    setFormData((prev) => ({
      ...prev,
      irlInstructions: [...prev.irlInstructions, { title: '', url: '' }],
    }));
  };

  const removeInstruction = (index: number) => {
    const newInstructions = formData.irlInstructions.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      irlInstructions: newInstructions,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleConnectRepo = async () => {
    if (!submissionSuccessData) return;

    setIsConnectingRepo(true);
    toast.loading('Preparing GitHub connection...');

    try {
      const response = await fetch('/api/github/connect-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: submissionSuccessData.gameId,
          repoUrl: submissionSuccessData.repoUrl,
        }),
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // If submission was successful, show the 'Next Step' UI
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
                    <button
                        onClick={handleConnectRepo}
                        disabled={isConnectingRepo}
                        className="w-full px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 flex items-center justify-center"
                    >
                        {isConnectingRepo ? <Spinner className="w-5 h-5 mr-2" /> : null}
                        {isConnectingRepo ? 'Connecting...' : 'Connect GitHub Repository'}
                    </button>
                </div>
                 <button onClick={() => router.push(`/profile/${user?.username}`)} className="mt-6 text-sm text-gray-600 hover:underline">
                    Cancel Submission
                </button>
            </div>
        </div>
    );
  }

  // Default form UI
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Toaster position="top-center" />
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Submit a Game for Review</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form fields are unchanged, so they are omitted here for brevity but should remain in your file */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Game Name</label>
            <input
              type="text" name="name" id="name" required
              value={formData.name} onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description" id="description" rows={3}
              value={formData.description} onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year</label>
              <input
                type="number" name="year" id="year" required
                value={formData.year} onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700">Version</label>
              <input
                type="text" name="version" id="version" required
                placeholder="e.g., 1.0.1"
                value={formData.version} onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700">Image URL</label>
            <input
              type="url" name="image" id="image" required
              placeholder="https://example.com/image.jpg"
              value={formData.image} onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          
          <div>
            <label htmlFor="codeUrl" className="block text-sm font-medium text-gray-700">Source Code URL</label>
            <input
              type="url" name="codeUrl" id="codeUrl" required
              placeholder="https://github.com/user/repo"
              value={formData.codeUrl} onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">IRL Instructions</h3>
            {formData.irlInstructions.map((inst, index) => (
              <div key={index} className="flex items-center gap-4 mb-3 p-3 border rounded-md bg-gray-50">
                <input
                  type="text" name="title" placeholder="Instruction Title"
                  value={inst.title} onChange={(e) => handleInstructionChange(index, e)}
                  className="block w-1/2 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500"
                />
                <input
                  type="url" name="url" placeholder="Instruction URL"
                  value={inst.url} onChange={(e) => handleInstructionChange(index, e)}
                  className="block w-1/2 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500"
                />
                <button
                  type="button" onClick={() => removeInstruction(index)}
                  className="text-red-500 hover:text-red-700 font-semibold"
                  disabled={formData.irlInstructions.length <= 1}
                >
                  X
                </button>
              </div>
            ))}
            <button
              type="button" onClick={addInstruction}
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              + Add Another Instruction
            </button>
          </div>
          
          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 flex items-center"
            >
              {mutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
              {mutation.isPending ? 'Submitting...' : 'Submit Game for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}