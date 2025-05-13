'use client'

import { useState, useEffect } from 'react';

interface GameCode {
  game: {
    id: number;
    name: string;
  };
  repo: {
    owner: string;
    name: string;
    url: string;
  };
  structure: any;
  packageJson: any;
  components: any[];
  services: any[];
  types: any[];
}

export default function GitHubExplorer() {
  const [gameName, setGameName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameCode, setGameCode] = useState<GameCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'components' | 'services' | 'types' | 'structure'>('components');
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  const fetchGameCode = async () => {
    if (!gameName.trim()) {
      setError('Please enter a game name');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/gamelab/gamecode?name=${encodeURIComponent(gameName)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch game code');
      }
      
      const data = await response.json();
      setGameCode(data.gameCode);
      
      // Set first component as active if available
      if (data.gameCode?.components?.length > 0) {
        setActiveFile(data.gameCode.components[0].name);
        setFileContent(data.gameCode.components[0].content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewFile = (file: any) => {
    setActiveFile(file.name);
    setFileContent(file.content);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">GitHub Repository Explorer</h1>
      
      <div className="mb-4 flex">
        <input
          type="text"
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          placeholder="Enter game name (e.g., Gotham Loops)"
          className="flex-1 p-2 border border-gray-300 rounded-l focus:outline-none"
        />
        <button
          onClick={fetchGameCode}
          disabled={isLoading}
          className="bg-emerald-500 text-white px-4 py-2 rounded-r hover:bg-emerald-600 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Fetch Code'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {gameCode && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 p-3 border-b">
            <h2 className="font-bold">
              Repository: <a href={gameCode.repo.url} target="_blank" className="text-blue-600 hover:underline">{gameCode.repo.owner}/{gameCode.repo.name}</a>
            </h2>
            <p>Game: {gameCode.game.name} (ID: {gameCode.game.id})</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4">
            {/* Sidebar */}
            <div className="bg-gray-50 p-3 border-r">
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Repository Contents</h3>
                <div className="flex mb-2 border-b">
                  <button
                    onClick={() => setActiveTab('components')}
                    className={`px-3 py-1 ${activeTab === 'components' ? 'bg-emerald-100 border-b-2 border-emerald-500' : ''}`}
                  >
                    Components
                  </button>
                  <button
                    onClick={() => setActiveTab('services')}
                    className={`px-3 py-1 ${activeTab === 'services' ? 'bg-emerald-100 border-b-2 border-emerald-500' : ''}`}
                  >
                    Services
                  </button>
                  <button
                    onClick={() => setActiveTab('types')}
                    className={`px-3 py-1 ${activeTab === 'types' ? 'bg-emerald-100 border-b-2 border-emerald-500' : ''}`}
                  >
                    Types
                  </button>
                </div>
                
                <div className="max-h-64 overflow-y-auto">
                  {activeTab === 'components' && gameCode.components && (
                    <ul className="space-y-1">
                      {gameCode.components.map((file, index) => (
                        <li key={index} className="text-sm">
                          <button
                            onClick={() => handleViewFile(file)}
                            className={`hover:bg-gray-200 text-left w-full p-1 rounded ${activeFile === file.name ? 'bg-gray-200 font-semibold' : ''}`}
                          >
                            {file.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {activeTab === 'services' && gameCode.services && (
                    <ul className="space-y-1">
                      {gameCode.services.map((file, index) => (
                        <li key={index} className="text-sm">
                          <button
                            onClick={() => handleViewFile(file)}
                            className={`hover:bg-gray-200 text-left w-full p-1 rounded ${activeFile === file.name ? 'bg-gray-200 font-semibold' : ''}`}
                          >
                            {file.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {activeTab === 'types' && gameCode.types && (
                    <ul className="space-y-1">
                      {gameCode.types.map((file, index) => (
                        <li key={index} className="text-sm">
                          <button
                            onClick={() => handleViewFile(file)}
                            className={`hover:bg-gray-200 text-left w-full p-1 rounded ${activeFile === file.name ? 'bg-gray-200 font-semibold' : ''}`}
                          >
                            {file.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {activeTab === 'structure' && gameCode.structure && (
                    <div className="text-sm p-2">
                      <h4 className="font-semibold">Files:</h4>
                      <ul className="list-disc pl-4 mt-1">
                        {gameCode.structure.files.map((file: string, idx: number) => (
                          <li key={idx} className="mb-1">{file}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Package Dependencies</h3>
                {gameCode.packageJson ? (
                  <div className="text-sm bg-gray-100 p-2 rounded max-h-48 overflow-y-auto">
                    {Object.entries(gameCode.packageJson.dependencies || {}).map(([pkg, version]: [string, any]) => (
                      <div key={pkg} className="mb-1">
                        <span className="font-mono">{pkg}:</span> <span className="text-gray-600">{version}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No package.json found</p>
                )}
              </div>
            </div>
            
            {/* File Viewer */}
            <div className="col-span-3 p-3">
              {fileContent ? (
                <div>
                  <h3 className="font-semibold mb-2">{activeFile}</h3>
                  <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                    {fileContent}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  Select a file to view its contents
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}