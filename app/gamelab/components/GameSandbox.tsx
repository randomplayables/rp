"use client"

import { useState, useEffect, useRef } from 'react';
import { Spinner } from '@/components/spinner';

interface GameSandboxProps {
  code: string;
  language: string;
  onSaveGame?: (gameData: any) => void;
}

const GameSandbox = ({ code, language }: GameSandboxProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gamePreview, setGamePreview] = useState<string | null>(null);
  const [testData, setTestData] = useState<any[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeSandboxGame, setActiveSandboxGame] = useState<any | null>(null);
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);

  // Create or reset a sandbox environment when code changes
  useEffect(() => {
    if (!code) return;
    
    const initSandbox = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Create a basic HTML container for the game
        const htmlTemplate = createGameHTML(code, language);
        setGamePreview(htmlTemplate);
        
        // Create a sandbox game entry
        const response = await fetch('/api/gamelab/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_game',
            data: {
              name: `Test Game ${new Date().toLocaleTimeString()}`,
              description: 'Created in GameLab Sandbox',
              link: '/gamelab/sandbox', // Placeholder link
              year: new Date().getFullYear()
            }
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          setActiveSandboxGame(data.game);
          console.log('Created sandbox game:', data.game);
          
          // Create a game session
          await createGameSession(data.game.id);
        } else {
          setError('Failed to create sandbox game');
        }
      } catch (err) {
        console.error('Sandbox initialization error:', err);
        setError(`Sandbox error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    initSandbox();
  }, [code, language]);
  
  // Create a game session for testing
  const createGameSession = async (gameId: string) => {
    try {
      const response = await fetch('/api/gamelab/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_session',
          data: { gameId }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGameSessionId(data.session.sessionId);
        console.log('Created game session:', data.session);
      }
    } catch (err) {
      console.error('Session creation error:', err);
      setError(`Session error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  // Save game data (can be triggered by the game or UI buttons)
  const saveGameData = async (roundData: any) => {
    if (!activeSandboxGame || !gameSessionId) {
      setError('No active game session');
      return;
    }
    
    try {
      const response = await fetch('/api/gamelab/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_game_data',
          data: {
            sessionId: gameSessionId,
            gameId: activeSandboxGame.id,
            roundNumber: 1,
            roundData
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Saved game data:', data.gameData);
        setTestData(prev => [...prev, data.gameData]);
      }
    } catch (err) {
      console.error('Save game data error:', err);
      setError(`Save error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GAMELAB_DATA') {
        console.log('Received data from game:', event.data.payload);
        saveGameData(event.data.payload);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeSandboxGame, gameSessionId]);
  
  // Reset the sandbox
  const resetSandbox = async () => {
    if (!activeSandboxGame) return;
    
    setIsLoading(true);
    await createGameSession(activeSandboxGame.id);
    setTestData([]);
    
    // Reload the iframe to reset the game state
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    
    setIsLoading(false);
  };
  
  // Create HTML template for the game
  const createGameHTML = (gameCode: string, lang: string) => {
    let processedCode = gameCode;
    
    // Add session ID to the code for API calls
    processedCode = processedCode.replace(
      'const API_BASE_URL',
      `const GAMELAB_SESSION_ID = "${gameSessionId}";\nconst API_BASE_URL`
    );
    
    // Add communication code to relay data back to parent
    const communicationCode = `
      // Add communication with parent window
      window.sendDataToGameLab = function(data) {
        window.parent.postMessage({
          type: 'GAMELAB_DATA',
          payload: data
        }, '*');
      };
    `;
    
    // Different templates based on language
    if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLab Sandbox</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${communicationCode}
    ${processedCode}
    
    // Add auto-mounting code if not present
    if (typeof App !== 'undefined') {
      ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    }
  </script>
</body>
</html>
      `;
    } else {
      // Default HTML/JS template
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLab Sandbox</title>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script>
    ${communicationCode}
    ${processedCode}
  </script>
</body>
</html>
      `;
    }
  };

  return (
    <div className="game-sandbox">
      <div className="sandbox-controls mb-3 flex justify-between items-center">
        <h3 className="text-lg font-semibold">Game Preview</h3>
        <div className="flex space-x-2">
          <button
            onClick={resetSandbox}
            disabled={isLoading || !activeSandboxGame}
            className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
          >
            Reset Game
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center min-h-[400px]">
          <Spinner />
          <span className="ml-2">Loading sandbox...</span>
        </div>
      ) : error ? (
        <div className="flex-1 p-4 bg-red-50 rounded-lg min-h-[400px] flex items-center justify-center">
          <div className="text-red-700">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden min-h-[400px] flex flex-col">
          {gamePreview && (
            <iframe
              ref={iframeRef}
              srcDoc={gamePreview}
              title="Game Preview"
              className="w-full flex-grow border-none"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
          
          {testData.length > 0 && (
            <div className="p-3 bg-gray-800 text-white text-sm max-h-[150px] overflow-y-auto">
              <p className="font-semibold mb-1">Test Data:</p>
              <pre className="text-xs">{JSON.stringify(testData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameSandbox;