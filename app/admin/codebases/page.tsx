"use client"

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { isAdmin } from '@/lib/auth'; // Import our new function

export default function CodebaseAdminPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [gameId, setGameId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !gameId) {
      setMessage('Please select a file and enter a game ID');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('gameId', gameId);
      formData.append('codebase', file);
      
      const response = await fetch('/api/admin/codebases/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage('Codebase uploaded successfully!');
        setGameId('');
        setFile(null);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('An error occurred during upload');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };
  
  if (!isLoaded) {
    return <div>Loading authentication...</div>;
  }
  
  if (!isSignedIn) {
    return <div>Please sign in to access admin features</div>;
  }
  
  // Replace the comment with actual admin check
  if (!isAdmin(user?.id, user?.username)) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p>You don't have permission to access this admin page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Codebase Management</h1>
      
      <form onSubmit={handleSubmit} className="max-w-md">
        <div className="mb-4">
          <label className="block mb-2">Game ID:</label>
          <input
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Codebase File (XML/TXT):</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full p-2 border rounded"
            accept=".xml,.txt"
            required
          />
        </div>
        
        {message && (
          <div className={`p-3 mb-4 rounded ${message.includes('Error') ? 'bg-red-100' : 'bg-green-100'}`}>
            {message}
          </div>
        )}
        
        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 bg-emerald-500 text-white rounded disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload Codebase'}
        </button>
      </form>
    </div>
  );
}