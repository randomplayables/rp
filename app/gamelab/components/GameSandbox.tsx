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
  const initCalled = useRef(false); // Ref for duplicate session creation fix

  const createGameHTML = useCallback((gameCode: string, lang: string, currentSessionId: string | null) => {
    const sessionIdScript = `const GAMELAB_SESSION_ID = "${currentSessionId || 'pending'}";`;

    const communicationCode = `
      window.sendDataToGameLab = function(data) {
        console.log('Game (in iframe) sending data to GameLab:', data);
        window.parent.postMessage({ type: 'GAMELAB_DATA', payload: data, source: 'GameSandbox' }, '*');
      };

      window.onerror = function(message, source, lineno, colno, error) {
        let M = message;
        let S = source;
        let L = lineno;
        let C = colno;
        let ST = error && typeof error.stack === 'string' ? error.stack : (typeof error === 'string' ? error : undefined);

        if (error) {
          if (typeof error === 'object' && error !== null) {
            M = String(error.message || M);
          } else if (typeof error === 'string') {
            M = error;
          }
        }

        const errorPayload = {
          message: String(M || "Unknown error from iframe"),
          source: String(S || "Unknown source"),
          lineno: L ? Number(L) : undefined,
          colno: C ? Number(C) : undefined,
          stack: ST
        };
        console.error('GameLab error (in iframe caught by window.onerror):', errorPayload);
        window.parent.postMessage({ type: 'GAMELAB_ERROR', payload: errorPayload }, '*');
        return true;
      };
    `;

    const containsHTML = gameCode.includes('<!DOCTYPE html>') || gameCode.includes('<html') || gameCode.includes('<body>');

    if (containsHTML) {
      const headMatch = gameCode.match(/<head>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        return gameCode.replace(/<head>([\s\S]*?)<\/head>/i, `<head>$1<script>${sessionIdScript}${communicationCode}<\/script></head>`);
      } else {
        return gameCode.replace(/<html[^>]*>/i, `$&<head><script>${sessionIdScript}${communicationCode}<\/script></head>`);
      }
    } else if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLab Sandbox</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin="anonymous"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin="anonymous"><\/script>
  <script>${sessionIdScript}${communicationCode}<\/script>
  <style>body,html{margin:0;padding:0;overflow:hidden;width:100%;height:100%}#game-container,#root{width:100%;height:100%}#error-display{position:absolute;bottom:0;left:0;right:0;background:rgba(255,0,0,0.8);color:white;padding:10px;font-family:monospace;white-space:pre-wrap;max-height:200px;overflow:auto;display:none;z-index:9999}<\/style>
</head>
<body>
  <div id="root"></div><div id="game-container"></div><div id="error-display"></div>
  <script>
    try {
      ${gameCode}

      const ComponentToRender = typeof App !== 'undefined' ? App : null;

      if (ComponentToRender && document.getElementById('root')) {
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ComponentToRender));
      } else if (!gameCode.trim()) {
      } else {
        const errorMsg = 'GameLab Sandbox Critical Error: Main "App" component was not found after transpilation. The compiled code did not define an "App" component that could be rendered.';
        console.error(errorMsg);
        const errorDisplay = document.getElementById('error-display');
        if(errorDisplay) { errorDisplay.style.display = 'block'; errorDisplay.innerText = errorMsg; }
        window.parent.postMessage({ type: 'GAMELAB_ERROR', payload: { message: errorMsg, source: 'GameSandboxLoader' } }, '*');
      }
    } catch (err) {
      console.error('Error executing compiled React code:', err.message, err.stack, err);
      const errorDisplay = document.getElementById('error-display');
      if(errorDisplay) { errorDisplay.style.display = 'block'; errorDisplay.innerText = 'Render Error: ' + err.message + '\\n' + err.stack; }
      window.parent.postMessage({ type: 'GAMELAB_ERROR', payload: { message: 'Render Error: ' + String(err.message), source: 'ExecutionCatch', lineno: err.lineno, colno: err.colno, stack: String(err.stack) } }, '*');
    }
  <\/script>
</body></html>`;
    } else {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameLab Sandbox</title>
  <script>${sessionIdScript}${communicationCode}<\/script>
  <style>body,html{margin:0;padding:0;overflow:hidden;width:100%;height:100%}#game-container{width:100%;height:100%}#error-display{position:absolute;bottom:0;left:0;right:0;background:rgba(255,0,0,0.8);color:white;padding:10px;font-family:monospace;white-space:pre-wrap;max-height:200px;overflow:auto;display:none;z-index:9999}<\/style>
</head>
<body>
  <div id="game-container"></div><div id="error-display"></div>
  <script>
    try {
      ${gameCode}
    } catch (err) {
      console.error('Error executing JavaScript code:', err.message, err.stack, err);
      const errorDisplay = document.getElementById('error-display');
      if(errorDisplay) { errorDisplay.style.display = 'block'; errorDisplay.innerText = err.message + '\\n' + err.stack; }
      window.parent.postMessage({ type: 'GAMELAB_ERROR', payload: { message: 'JS Execution Error: ' + String(err.message), source: 'UserScriptCatch', lineno: err.lineno, colno: err.colno, stack: String(err.stack) } }, '*');
    }
  <\/script>
</body></html>`;
    }
  }, []);

  useEffect(() => {
    if (initCalled.current && process.env.NODE_ENV === 'development') {
      return;
    }

    if (!code) {
      setGamePreview(null);
      setActiveSandboxGame(null);
      setGameSessionId(null);
      setIsLoading(false);
      return;
    }
    const initSandbox = async () => {
      setIsLoading(true);
      setError(null);
      setActiveSandboxGame(null);
      setGameSessionId(null);
      setGamePreview(null);
      setTestData([]);
      try {
        const gameResponse = await fetch('/api/gamelab/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_game', data: { name: `Test Game ${new Date().toLocaleTimeString()}`, description: 'Created in GameLab Sandbox', link: '/gamelab/sandbox', year: new Date().getFullYear() }})
        });
        const gameData = await gameResponse.json();
        if (!gameData.success || !gameData.game) {
          setError('Failed to create sandbox game entry.');
          console.error("GameSandbox: Failed to create_game", gameData);
          setIsLoading(false);
          return;
        }
        setActiveSandboxGame(gameData.game);

        const sessionResponse = await fetch('/api/gamelab/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_session', data: { gameId: gameData.game.gameId } })
        });
        const sessionData = await sessionResponse.json();
        if (!sessionData.success || !sessionData.session) {
          setError('Failed to create sandbox session.');
          console.error("GameSandbox: Failed to create_session", sessionData);
          setIsLoading(false);
          return;
        }
        setGameSessionId(sessionData.session.sessionId);

        const htmlTemplate = createGameHTML(code, language, sessionData.session.sessionId);
        setGamePreview(htmlTemplate);
      } catch (err) {
        console.error('GameSandbox: Error during sandbox initialization:', err);
        setError(`Sandbox init error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };
    initSandbox();
    
    return () => {
        if(process.env.NODE_ENV === 'development') {
            initCalled.current = true;
        }
    }
  }, [code, language, createGameHTML]);

  const saveGameData = useCallback(async (payloadFromGame: any) => {
    if (!activeSandboxGame || !gameSessionId) {
      const errorMsg = 'Cannot save data: No active game or session ID.';
      setError(errorMsg); console.error('GameSandbox: Save data attempt failed', { activeSandboxGame, gameSessionId });
      return;
    }
    try {
      // BUG FIX: Incorrect Round-by-Round Data Logging
      // The roundNumber is now dynamically read from the game's payload.
      const roundNumber = payloadFromGame.roundNumber;
      const response = await fetch('/api/gamelab/sandbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_game_data', data: { sessionId: gameSessionId, gameId: activeSandboxGame.gameId, roundNumber: roundNumber, roundData: payloadFromGame }})
      });
      const data = await response.json();
      if (data.success) { setTestData(prev => [...prev, data.gameData]); }
      else { setError(`Failed to save data: ${data.error || 'Unknown'}`); }
    } catch (err) {
      setError(`Save error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [activeSandboxGame, gameSessionId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || !event.data.type || !iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      if (event.data.type === 'GAMELAB_DATA') {
        saveGameData(event.data.payload);
      } else if (event.data.type === 'GAMELAB_ERROR') {
        let actualPayloadObject = event.data.payload;

        if (typeof actualPayloadObject === 'string') {
          try {
            actualPayloadObject = JSON.parse(actualPayloadObject);
          } catch (e) {
            console.error('GameSandbox: Failed to parse GAMELAB_ERROR string payload:', actualPayloadObject, e);
            actualPayloadObject = {
              message: `Malformed error payload (was string): ${actualPayloadObject}`,
              source: "GameSandboxHandler",
              stack: `Error parsing payload string: ${e instanceof Error ? e.message : String(e)}`
            };
          }
        }

        const payload = actualPayloadObject || {};
        let displayMessage = String(payload.message || "Script error.");
        if ((displayMessage === "Script error." || displayMessage === "Unknown error from iframe" || displayMessage.includes("Error: GameLab Sandbox Critical Error")) && payload.stack) {
            const firstLineOfStack = String(payload.stack).split('\n')[0];
            if (firstLineOfStack) displayMessage = firstLineOfStack;
        }

        const lineInfo = payload.lineno ? ` (Line: ${payload.lineno}${payload.colno ? `, Col: ${payload.colno}` : ''})` : '';
        let sourceInfo = '';
        if (payload.source && payload.source !== "Unknown source" &&
            !String(payload.source).includes("unpkg.com") &&
            !String(payload.source).includes("babel.min.js") &&
            !["GameSandboxLoader", "BabelExecutionCatch", "UserScriptCatch", "GameSandboxHandler", "ExecutionCatch"].includes(String(payload.source))) {
          sourceInfo = ` in ${payload.source}`;
        }

        setError(`Game error: ${displayMessage}${lineInfo}${sourceInfo}`);

        if (payload.stack) {
            console.error("Full error stack from iframe (if available):\n", payload.stack);
        } else {
            console.log("No stack trace available in error payload from iframe.");
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [saveGameData]);

  const resetSandbox = async () => {
    if (!activeSandboxGame) { return; }
    setIsLoading(true); setTestData([]); setError(null);
    try {
      const sessionResponse = await fetch('/api/gamelab/sandbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_session', data: { gameId: activeSandboxGame.gameId } })
      });
      const sessionData = await sessionResponse.json();
      if (sessionData.success && sessionData.session) {
        setGameSessionId(sessionData.session.sessionId);
        const htmlTemplate = createGameHTML(code, language, sessionData.session.sessionId);
        setGamePreview(htmlTemplate);
        if (iframeRef.current) {
          iframeRef.current.src = 'about:blank';
          setTimeout(() => { if (iframeRef.current) { iframeRef.current.srcdoc = htmlTemplate; }}, 50);
        }
      } else {
        setError('Failed to create new session for reset.');
      }
    } catch (err) {
      setError(`Reset error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="game-sandbox w-full h-full flex flex-col">
      <div className="sandbox-controls mb-3 flex justify-between items-center">
        <h3 className="text-lg font-semibold">Game Preview</h3>
        <button onClick={resetSandbox} disabled={isLoading || !activeSandboxGame} className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50">
          Reset Game
        </button>
      </div>

      {error && (
        <div className="mb-2 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          <p className="font-semibold">Error:</p>
          <pre className="whitespace-pre-wrap break-all">{error}</pre>
        </div>
      )}

      <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden min-h-[400px] flex flex-col">
        {isLoading && !gamePreview ? (
          <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center">
            <Spinner /><span className="ml-2">Loading sandbox...</span>
          </div>
        ) : gamePreview ? (
          <iframe ref={iframeRef} srcDoc={gamePreview} title="Game Preview" className="w-full flex-grow border-none" sandbox="allow-scripts allow-same-origin" />
        ) : !isLoading && !code ? (
             <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center"><p className="text-gray-500">Enter code and chat with the AI to generate a game.</p></div>
        ) : !isLoading && !error ? (
            <div className="flex-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center"><p className="text-gray-500">Sandbox is ready. Game will load shortly.</p></div>
        ) : null}

        {testData.length > 0 && (
          <div className="p-3 bg-gray-800 text-white text-sm max-h-[150px] overflow-y-auto">
            <p className="font-semibold mb-1">Test Data Log (from GameLabSandbox.gamedatas):</p>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(testData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameSandbox;