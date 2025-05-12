"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { Spinner } from '@/components/spinner';

interface GameSandboxProps {
  code: string;
  language: string;
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
  const saveGameData = useCallback(async (roundData: any) => {
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
  }, [activeSandboxGame, gameSessionId]);
  
  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      
      if (event.data.type === 'GAMELAB_DATA') {
        console.log('Received data from game:', event.data.payload);
        saveGameData(event.data.payload);
      }
      else if (event.data.type === 'GAMELAB_ERROR') {
        console.error('Received error from game:', event.data.payload);
        setError(`Game error: ${event.data.payload.message}\nLine: ${event.data.payload.lineno}\nColumn: ${event.data.payload.colno}`);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeSandboxGame, gameSessionId, saveGameData]);
  
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
    // Add logging to help diagnose issues
    console.log("Creating game HTML with code length:", gameCode.length);
    console.log("Language:", lang);
    
    // Prepare the session ID for communication
    const sessionIdScript = `const GAMELAB_SESSION_ID = "${gameSessionId || 'pending'}";`;
    
    // Add communication code to relay data back to parent
    const communicationCode = `
      // Add communication with parent window
      window.sendDataToGameLab = function(data) {
        window.parent.postMessage({
          type: 'GAMELAB_DATA',
          payload: data
        }, '*');
      };
      
      // Add error handling
      window.onerror = function(message, source, lineno, colno, error) {
        console.error('GameLab error:', message, error);
        window.parent.postMessage({
          type: 'GAMELAB_ERROR',
          payload: { message, source, lineno, colno, stack: error?.stack }
        }, '*');
        return true; // Prevent default error handling
      };
    `;
    
    // Check if code contains HTML structure
    const containsHTML = gameCode.includes('<!DOCTYPE html>') || 
                          gameCode.includes('<html') || 
                          gameCode.includes('<body>');
    
    if (containsHTML) {
      // This is a complete HTML document, inject our communication code
      const headMatch = gameCode.match(/<head>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        // Insert communication script in the head
        return gameCode.replace(
          /<head>([\s\S]*?)<\/head>/i,
          `<head>$1<script>${sessionIdScript}${communicationCode}</script></head>`
        );
      } else {
        // If no head tag, insert one with our script
        return gameCode.replace(
          /<html[^>]*>/i,
          `$&<head><script>${sessionIdScript}${communicationCode}</script></head>`
        );
      }
    } else if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
      // React-specific template
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
  <script>${sessionIdScript}${communicationCode}</script>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container { width: 100%; height: 100%; }
    #error-display { 
      position: absolute; 
      bottom: 0; 
      left: 0; 
      right: 0; 
      background: rgba(255,0,0,0.8); 
      color: white; 
      padding: 10px; 
      font-family: monospace; 
      white-space: pre-wrap; 
      max-height: 200px; 
      overflow: auto; 
      display: none; 
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="game-container"></div>
  <div id="error-display"></div>
  <script type="text/babel">
    // Error handling for React
    window.addEventListener('error', (event) => {
      const errorDisplay = document.getElementById('error-display');
      errorDisplay.style.display = 'block';
      errorDisplay.innerText = event.message + '\\n' + (event.error?.stack || '');
    });
    
    try {
      ${gameCode}
      
      // Add auto-mounting code if not present
      if (typeof App !== 'undefined') {
        ReactDOM.createRoot(document.getElementById('root')).render(<App />);
      }
    } catch (err) {
      console.error('Error executing React code:', err);
      document.getElementById('error-display').style.display = 'block';
      document.getElementById('error-display').innerText = err.message + '\\n' + err.stack;
    }
  </script>
</body>
</html>
      `;
    } else if (lang === 'html') {
      // If it's HTML but not a complete document, wrap it
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLab Sandbox</title>
  <script>${sessionIdScript}${communicationCode}</script>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container { width: 100%; height: 100%; }
    #error-display { 
      position: absolute; 
      bottom: 0; 
      left: 0; 
      right: 0; 
      background: rgba(255,0,0,0.8); 
      color: white; 
      padding: 10px; 
      font-family: monospace; 
      white-space: pre-wrap; 
      max-height: 200px; 
      overflow: auto; 
      display: none; 
    }
  </style>
</head>
<body>
  ${gameCode}
  <div id="error-display"></div>
  <script>
    // Error handling
    window.addEventListener('error', (event) => {
      const errorDisplay = document.getElementById('error-display');
      errorDisplay.style.display = 'block';
      errorDisplay.innerText = event.message + '\\n' + (event.error?.stack || '');
    });
  </script>
</body>
</html>
      `;
    } else {
      // Default JavaScript template with a proper wrapper
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLab Sandbox</title>
  <script>${sessionIdScript}${communicationCode}</script>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container { width: 100%; height: 100%; }
    #error-display { 
      position: absolute; 
      bottom: 0; 
      left: 0; 
      right: 0; 
      background: rgba(255,0,0,0.8); 
      color: white; 
      padding: 10px; 
      font-family: monospace; 
      white-space: pre-wrap; 
      max-height: 200px; 
      overflow: auto; 
      display: none; 
    }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <div id="error-display"></div>
  <script>
    // Error handling
    window.addEventListener('error', (event) => {
      const errorDisplay = document.getElementById('error-display');
      errorDisplay.style.display = 'block';
      errorDisplay.innerText = event.message + '\\n' + (event.error?.stack || '');
    });
    
    try {
      ${gameCode}
    } catch (err) {
      console.error('Error executing JavaScript code:', err);
      document.getElementById('error-display').style.display = 'block';
      document.getElementById('error-display').innerText = err.message + '\\n' + err.stack;
    }
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
              sandbox="allow-scripts"
              onLoad={() => {
                console.log("Game iframe loaded");
                // Clear any previous error displays
                setError(null);
              }}
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