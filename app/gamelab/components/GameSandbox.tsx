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

  // Create HTML template for the game
  // Modified to accept currentSessionId as a parameter
  const createGameHTML = (gameCode: string, lang: string, currentSessionId: string | null) => {
    console.log("GameSandbox: Creating game HTML. Session ID for injection:", currentSessionId);
    const sessionIdScript = `const GAMELAB_SESSION_ID = "${currentSessionId || 'pending'}";`;
    
    const communicationCode = `
      // Add communication with parent window
      window.sendDataToGameLab = function(data) {
        console.log('Game (in iframe) sending data to GameLab:', data);
        window.parent.postMessage({
          type: 'GAMELAB_DATA',
          payload: data
        }, '*');
      };
      
      // Add error handling
      window.onerror = function(message, source, lineno, colno, error) {
        console.error('GameLab error (in iframe):', message, error);
        window.parent.postMessage({
          type: 'GAMELAB_ERROR',
          payload: { message, source, lineno, colno, stack: error?.stack }
        }, '*');
        return true; // Prevent default error handling
      };
    `;
    
    const containsHTML = gameCode.includes('<!DOCTYPE html>') || 
                          gameCode.includes('<html') || 
                          gameCode.includes('<body>');
    
    if (containsHTML) {
      const headMatch = gameCode.match(/<head>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        return gameCode.replace(
          /<head>([\s\S]*?)<\/head>/i,
          `<head>$1<script>${sessionIdScript}${communicationCode}<\/script></head>`
        );
      } else {
        return gameCode.replace(
          /<html[^>]*>/i,
          `$&<head><script>${sessionIdScript}${communicationCode}<\/script></head>`
        );
      }
    } else if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
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
  <script>${sessionIdScript}${communicationCode}<\/script>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container, #root { width: 100%; height: 100%; }
    #error-display { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(255,0,0,0.8); color: white; padding: 10px; font-family: monospace; white-space: pre-wrap; max-height: 200px; overflow: auto; display: none; z-index: 9999;}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="game-container"></div>
  <div id="error-display"></div>
  <script type="text/babel">
    window.addEventListener('error', (event) => {
      const errorDisplay = document.getElementById('error-display');
      if(errorDisplay) {
        errorDisplay.style.display = 'block';
        errorDisplay.innerText = event.message + '\\n' + (event.error?.stack || '');
      }
    });
    try {
      ${gameCode}
      if (typeof App !== 'undefined' && document.getElementById('root')) {
        ReactDOM.createRoot(document.getElementById('root')).render(<App />);
      }
    } catch (err) {
      console.error('Error executing React code:', err);
      const errorDisplay = document.getElementById('error-display');
      if(errorDisplay) {
        errorDisplay.style.display = 'block';
        errorDisplay.innerText = err.message + '\\n' + err.stack;
      }
    }
  <\/script>
</body>
</html>`;
    } else {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLab Sandbox</title>
  <script>${sessionIdScript}${communicationCode}<\/script>
  <style>
    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
    #game-container { width: 100%; height: 100%; }
    #error-display { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(255,0,0,0.8); color: white; padding: 10px; font-family: monospace; white-space: pre-wrap; max-height: 200px; overflow: auto; display: none; z-index: 9999;}
  </style>
</head>
<body>
  <div id="game-container"></div>
  <div id="error-display"></div>
  <script>
    window.addEventListener('error', (event) => {
      const errorDisplay = document.getElementById('error-display');
      if(errorDisplay) {
        errorDisplay.style.display = 'block';
        errorDisplay.innerText = event.message + '\\n' + (event.error?.stack || '');
      }
    });
    try {
      ${gameCode}
    } catch (err) {
      console.error('Error executing JavaScript code:', err);
      const errorDisplay = document.getElementById('error-display');
      if(errorDisplay) {
        errorDisplay.style.display = 'block';
        errorDisplay.innerText = err.message + '\\n' + err.stack;
      }
    }
  <\/script>
</body>
</html>`;
    }
  };

  // Effect to initialize sandbox when code or language changes
  useEffect(() => {
    if (!code) {
      setGamePreview(null);
      setActiveSandboxGame(null);
      setGameSessionId(null);
      setIsLoading(false);
      return;
    }

    console.log("GameSandbox: Code or language changed, re-initializing sandbox.");
    const initSandbox = async () => {
      setIsLoading(true);
      setError(null);
      setActiveSandboxGame(null);
      setGameSessionId(null);
      setGamePreview(null);
      setTestData([]); // Clear previous test data

      try {
        // Step 1: Create the sandbox game entry
        console.log("GameSandbox: Creating sandbox game entry...");
        const gameResponse = await fetch('/api/gamelab/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_game',
            data: {
              name: `Test Game ${new Date().toLocaleTimeString()}`,
              description: 'Created in GameLab Sandbox',
              link: '/gamelab/sandbox', 
              year: new Date().getFullYear()
            }
          })
        });
        const gameData = await gameResponse.json();

        if (!gameData.success || !gameData.game) {
          setError('Failed to create sandbox game entry.');
          console.error("GameSandbox: Failed to create_game", gameData);
          setIsLoading(false);
          return;
        }
        console.log('GameSandbox: Sandbox game created:', gameData.game);
        setActiveSandboxGame(gameData.game);

        // Step 2: Create the game session for the newly created game
        console.log("GameSandbox: Creating game session for game ID:", gameData.game.id);
        const sessionResponse = await fetch('/api/gamelab/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_session',
            data: { gameId: gameData.game.id } 
          })
        });
        const sessionData = await sessionResponse.json();

        if (!sessionData.success || !sessionData.session) {
          setError('Failed to create sandbox session.');
          console.error("GameSandbox: Failed to create_session", sessionData);
          setIsLoading(false);
          return;
        }
        console.log('GameSandbox: Game session created:', sessionData.session);
        setGameSessionId(sessionData.session.sessionId);

        // Step 3: Generate and set the HTML for the iframe
        console.log("GameSandbox: Generating HTML for iframe with session ID:", sessionData.session.sessionId);
        const htmlTemplate = createGameHTML(code, language, sessionData.session.sessionId);
        setGamePreview(htmlTemplate);

      } catch (err) {
        console.error('GameSandbox: Error during sandbox initialization:', err);
        setError(`Sandbox initialization error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    initSandbox();
  }, [code, language]);


  // Save game data (can be triggered by the game or UI buttons)
  const saveGameData = useCallback(async (roundDataFromGame: any) => {
    console.log("GameSandbox: saveGameData called with:", roundDataFromGame);
    console.log("GameSandbox: Current activeSandboxGame:", activeSandboxGame);
    console.log("GameSandbox: Current gameSessionId:", gameSessionId);

    if (!activeSandboxGame || !gameSessionId) {
      const errorMsg = 'Cannot save data: No active game or session ID is available. The sandbox might still be initializing or failed to initialize.';
      setError(errorMsg);
      console.error('GameSandbox: Attempted to save data without active game or sessionID', { activeSandboxGame, gameSessionId });
      return;
    }
    
    try {
      console.log("GameSandbox: Sending data to backend:", { action: 'save_game_data', data: { sessionId: gameSessionId, gameId: activeSandboxGame.id, roundNumber: 1, roundData: roundDataFromGame } });
      const response = await fetch('/api/gamelab/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_game_data',
          data: {
            sessionId: gameSessionId,
            gameId: activeSandboxGame.id,
            roundNumber: 1, // Assuming round 1 for now, this could be dynamic
            roundData: roundDataFromGame
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('GameSandbox: Saved game data successfully:', data.gameData);
        setTestData(prev => [...prev, data.gameData]);
      } else {
        console.error('GameSandbox: Failed to save game data to backend:', data.error);
        setError(`Failed to save game data: ${data.error || 'Unknown backend error'}`);
      }
    } catch (err) {
      console.error('GameSandbox: Error in saveGameData fetch:', err);
      setError(`Save error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [activeSandboxGame, gameSessionId]);
  
  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      console.log("GameSandbox: Message received from iframe", event.data);
      
      if (event.data.type === 'GAMELAB_DATA') {
        console.log('GameSandbox: Received GAMELAB_DATA from game:', event.data.payload);
        saveGameData(event.data.payload);
      }
      else if (event.data.type === 'GAMELAB_ERROR') {
        console.error('GameSandbox: Received GAMELAB_ERROR from game:', event.data.payload);
        const { message, lineno, colno } = event.data.payload;
        setError(`Game error: ${message}${lineno ? ` (Line: ${lineno}, Col: ${colno})` : ''}`);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => {
      console.log("GameSandbox: Removing message listener");
      window.removeEventListener('message', handleMessage);
    }
  }, [saveGameData]); // saveGameData is memoized with useCallback
  
  // Reset the sandbox
  const resetSandbox = async () => {
    if (!activeSandboxGame) {
      console.warn("GameSandbox: Reset called but no active sandbox game.");
      return;
    }
    
    console.log("GameSandbox: Resetting sandbox...");
    setIsLoading(true);
    setTestData([]); // Clear test data
    setError(null); // Clear errors

    try {
        // Re-create a game session for the current active game
        console.log("GameSandbox: Re-creating game session for game ID:", activeSandboxGame.id);
        const sessionResponse = await fetch('/api/gamelab/sandbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create_session',
                data: { gameId: activeSandboxGame.id }
            })
        });
        const sessionData = await sessionResponse.json();

        if (sessionData.success && sessionData.session) {
            console.log('GameSandbox: New session created for reset:', sessionData.session);
            setGameSessionId(sessionData.session.sessionId);
            
            // Regenerate HTML with the new session ID and reload iframe
            const htmlTemplate = createGameHTML(code, language, sessionData.session.sessionId);
            setGamePreview(htmlTemplate); // This will cause the iframe to reload via srcDoc change
             if (iframeRef.current) {
                 // Forcing a reload if srcDoc method isn't consistent
                 iframeRef.current.src = 'about:blank';
                 setTimeout(() => {
                     if (iframeRef.current) {
                        iframeRef.current.srcdoc = htmlTemplate;
                     }
                 }, 50);
             }

        } else {
            setError('Failed to create new session for reset.');
            console.error("GameSandbox: Failed to create_session on reset", sessionData);
        }
    } catch (err) {
        console.error('GameSandbox: Error during sandbox reset:', err);
        setError(`Reset error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
        setIsLoading(false);
    }
  };
  
  return (
    <div className="game-sandbox w-full h-full flex flex-col">
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
      
      {error && (
        <div className="mb-2 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          <p className="font-semibold">Error:</p>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}
      
      <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden min-h-[400px] flex flex-col">
        {isLoading && !gamePreview ? ( // Show loading spinner only if preview is not yet ready
          <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center">
            <Spinner />
            <span className="ml-2">Loading sandbox...</span>
          </div>
        ) : gamePreview ? (
          <iframe
            ref={iframeRef}
            srcDoc={gamePreview}
            title="Game Preview"
            className="w-full flex-grow border-none"
            sandbox="allow-scripts allow-same-origin" // allow-same-origin might be needed for some complex games, but be cautious
            onLoad={() => {
              console.log("GameSandbox: Iframe loaded.");
            }}
          />
        ) : !isLoading && !code ? (
             <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Enter code and chat with the AI to generate a game.</p>
            </div>
        ) : !isLoading && !error ? (
            <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Sandbox is ready. Waiting for game code to generate preview.</p>
            </div>
        ) : null /* Error is displayed above */
        }
        
        {testData.length > 0 && (
          <div className="p-3 bg-gray-800 text-white text-sm max-h-[150px] overflow-y-auto">
            <p className="font-semibold mb-1">Test Data Log (from GameLabSandbox.gamedatas):</p>
            <pre className="text-xs">{JSON.stringify(testData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameSandbox;