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

// MODIFIED: Removed 'link'
interface GameSubmissionData {
  name: string;
  description: string;
  year: number;
  image: string;
  codeUrl: string;
  irlInstructions: IrlInstruction[];
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

  // MODIFIED: Removed 'link' from initial state
  const [formData, setFormData] = useState<GameSubmissionData>({
    name: '',
    description: '',
    year: new Date().getFullYear(),
    image: '',
    codeUrl: '',
    irlInstructions: [{ title: '', url: '' }],
  });

  const mutation = useMutation({
    mutationFn: submitGame,
    onSuccess: (data) => {
      toast.success('Game submitted for review successfully!');
      router.push(`/profile/${user?.username}`);
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

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Toaster position="top-center" />
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Submit a Game for Review</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <label htmlFor="image" className="block text-sm font-medium text-gray-700">Image URL</label>
              <input
                type="url" name="image" id="image" required
                placeholder="https://example.com/image.jpg"
                value={formData.image} onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          
          {/* REMOVED: Playable Game Link field */}
          
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