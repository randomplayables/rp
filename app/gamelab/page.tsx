"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import GameIDE from './components/GameIDE';
import SaveSketchButton from './components/SaveSketchButton';
import GitHubUploadButton from './components/GitHubUploadButton';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUser } from "@clerk/nextjs";
import { ModelDefinition, getAvailableModelsForUser } from "@/lib/modelConfig";
import {
  BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT,
  BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT,
  BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS
} from "./prompts";
import { SandpackProvider, useSandpack, SandpackFiles, SandpackCodeEditor, SandpackPreview } from "@codesandbox/sandpack-react";
import { CodeBlock } from './components/CodeBlock';
import GameSandbox from "./components/GameSandbox";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GameLabApiResponse {
  message: string;
  files?: Record<string, string>;
  originalCode?: string;
  code?: string;
  language?: string;
  error?: string;
  limitReached?: boolean;
  remainingRequests?: number;
}

const defaultFiles: SandpackFiles = {
    "/index.html": {
      code: `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>React Game</title>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>`,
    },
    "/src/index.tsx": {
      code: `import React from "react";
  import ReactDOM from "react-dom/client";
  import App from "./App";
  import "./styles.css";
  
  const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );`,
    },
    "/src/App.tsx": {
      code: `import React from 'react';

export default function App(): JSX.Element {
  return <h1>Hello world</h1>
}`,
      active: true,
    },
    "/src/styles.css": {
      code: `html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #333;
}

body {
    font-family: sans-serif;
    -webkit-font-smoothing: auto;
    -moz-font-smoothing: auto;
    -moz-osx-font-smoothing: grayscale;
    font-smoothing: auto;
    text-rendering: optimizeLegibility;
    font-smooth: always;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }
  
  h1 {
    color: #10B981;
  }
  `,
    },
    "/package.json": {
      code: JSON.stringify({
        dependencies: {
          react: "^18.0.0",
          "react-dom": "^18.0.0",
          "react-scripts": "^5.0.0",
        },
      }),
      hidden: true,
    },
  };

async function fetchGamelabContextData() {
  const response = await fetch("/api/gamelab/context-data");
  if (!response.ok) {
    throw new Error('Failed to fetch GameLab context data');
  }
  return response.json();
}

async function sendChatMessageToApi(formData: FormData) {
  const response = await fetch("/api/gamelab/chat", {
    method: "POST",
    body: formData
  });
  return response.json();
}

function GamelabWorkspace() {
    const { sandpack } = useSandpack();
    const { files, updateFile, setActiveFile } = sandpack;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [language, setLanguage] = useState('tsx');
    const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
    const [currentCoderSystemPrompt, setCurrentCoderSystemPrompt] = useState<string | null>(null);
    const [currentReviewerSystemPrompt, setCurrentReviewerSystemPrompt] = useState<string | null>(null);
    const [baseCoderTemplateWithContext, setBaseCoderTemplateWithContext] = useState<string | null>(null);
    const [baseReviewerTemplateWithContext, setBaseReviewerTemplateWithContext] = useState<string | null>(null);
    const [isLoadingSystemPrompts, setIsLoadingSystemPrompts] = useState(true);
    const [useCodeReview, setUseCodeReview] = useState<boolean>(false);
    const [selectedCoderModel, setSelectedCoderModel] = useState<string>("");
    const [selectedReviewerModel, setSelectedReviewerModel] = useState<string>("");
    const [availableModels, setAvailableModels] = useState<ModelDefinition[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);
    const { user, isSignedIn, isLoaded: isUserLoaded } = useUser();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // State for the single-file Vanilla JS sandbox 
    const [originalCode, setOriginalCode] = useState<string>("");
    const [sandboxCode, setSandboxCode] = useState<string>("");
    const [currentTab, setCurrentTab] = useState<'code' | 'sandbox'>('code');
    const [codeError, setCodeError] = useState<string | null>(null);
    
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sandpackTestData, setSandpackTestData] = useState<any[]>([]);


    const suggestedPrompts = {
      tsx: [
        "Create a number guessing game as a React/TSX sketch",
        "I want a simple grid-based puzzle game in React/TSX for the sandbox",
        "Help me design a memory matching game (React/TSX sketch)",
      ],
      javascript: [
          "Create a simple clicker game with Vanilla JS",
          "Make a Vanilla JS game where a circle avoids the mouse cursor",
          "Build a basic 'Whack-a-Mole' game using plain JavaScript and CSS",
      ]
    };

    const chatMutation = useMutation<GameLabApiResponse, Error, FormData>({
        mutationFn: (formData) => sendChatMessageToApi(formData),
        onSuccess: async (data: GameLabApiResponse) => {
            const assistantMessage: ChatMessage = { role: 'assistant', content: data.message, timestamp: new Date() };
            setMessages(prev => [...prev, assistantMessage]);
    
            if (data.error) {
                setCodeError(data.error);
                return;
            }
    
            setCodeError(null);
    
            if (data.language === 'tsx') {
                setSandpackTestData([]); // Clear previous test data
                let filesToUpdate: SandpackFiles = {};
                if (data.files && Object.keys(data.files).length > 0) {
                    filesToUpdate = { ...data.files };
                } else if (data.originalCode) {
                    filesToUpdate['/src/App.tsx'] = { code: data.originalCode };
                } else {
                    return; // Nothing to update
                }
    
                try {
                    // 1. Create a game entry
                    const gameRes = await fetch('/api/gamelab/sandbox', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'create_game', data: { name: `React Sketch ${Date.now()}` } })
                    });
                    const gameData = await gameRes.json();
                    if (!gameData.success) throw new Error("Failed to create sandbox game entry.");
    
                    // 2. Create a session for that game
                    const sessionRes = await fetch('/api/gamelab/sandbox', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'create_session', data: { gameId: gameData.game.id } })
                    });
                    const sessionData = await sessionRes.json();
                    if (!sessionData.success) throw new Error("Failed to create sandbox session.");
                    
                    const newSessionId = sessionData.session.sessionId;
                    const gameIdForScript = gameData.game.id;
    
                    // 3. Prepare communication script as a new file
                    const communicationScript = `
                        window.GAMELAB_SESSION_ID = "${newSessionId || 'pending'}";
                        window.GAMELAB_GAME_ID = "${gameIdForScript || 'pending'}";

                        window.sendDataToGameLab = function(data) {
                            console.log('Game (in Sandpack) sending data to GameLab:', data);
                            const payloadWithSession = { 
                                ...data, 
                                sessionId: window.GAMELAB_SESSION_ID,
                                gameId: window.GAMELAB_GAME_ID 
                            };
                            window.parent.postMessage({ type: 'GAMELAB_DATA', payload: payloadWithSession }, '*');
                        };

                        window.onerror = function(message, source, lineno, colno, error) {
                          let M = message, S = source, L = lineno, C = colno;
                          let ST = error && typeof error.stack === 'string' ? error.stack : (typeof error === 'string' ? error : undefined);
                  
                          if (error) {
                            if (typeof error === 'object' && error !== null) { M = String(error.message || M); } 
                            else if (typeof error === 'string') { M = error; }
                          }
                  
                          const errorPayload = {
                            message: String(M || "Unknown error from iframe"), source: String(S || "Unknown source"),
                            lineno: L ? Number(L) : undefined, colno: C ? Number(C) : undefined, stack: ST
                          };
                          console.error('GameLab error (in iframe caught by window.onerror):', errorPayload);
                          window.parent.postMessage({ type: 'GAMELAB_ERROR', payload: errorPayload }, '*');
                          return true;
                        };
                    `;
                    filesToUpdate['/src/communication.js'] = { code: communicationScript, hidden: true };

                    // 4. Modify entry file to import the new communication script
                    const entryFilePath = '/src/index.tsx';
                    const existingEntryFile = filesToUpdate[entryFilePath];
                    let originalEntryFileCode: string;

                    if (typeof existingEntryFile === 'string') {
                        originalEntryFileCode = existingEntryFile;
                    } else if (existingEntryFile && typeof existingEntryFile.code === 'string') {
                        originalEntryFileCode = existingEntryFile.code;
                    } else {
                        // The default file is an object with a code property
                        originalEntryFileCode = (defaultFiles[entryFilePath] as { code: string }).code;
                    }
                    
                    const modifiedEntryFileCode = `import './communication.js';\n${originalEntryFileCode}`;
                    filesToUpdate[entryFilePath] = { code: modifiedEntryFileCode, hidden: true };

    
                    // Ensure other default files are present
                    if (!filesToUpdate['/index.html']) filesToUpdate['/index.html'] = defaultFiles['/index.html'];
                    if (!filesToUpdate['/src/styles.css']) filesToUpdate['/src/styles.css'] = defaultFiles['/src/styles.css'];
                    if (!filesToUpdate['/package.json']) filesToUpdate['/package.json'] = defaultFiles['/package.json'];
    
                    // 5. Update Sandpack files
                    Object.entries(filesToUpdate).forEach(([path, fileOrCode]) => {
                        if (typeof fileOrCode === 'string') {
                            updateFile(path, fileOrCode, false);
                        } else if (fileOrCode && typeof fileOrCode.code === 'string') {
                            updateFile(path, fileOrCode.code, fileOrCode.hidden || false);
                        }
                    });
                    
                    if (filesToUpdate['/src/App.tsx']) setActiveFile('/src/App.tsx');
    
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during sandbox setup.";
                    console.error("Sandbox setup error:", err);
                    setCodeError(errorMessage);
                }
    
            } else if (data.language === 'javascript') {
              console.log("Received single-file JavaScript response, updating Sandbox...");
              setOriginalCode(data.originalCode || '');
              setSandboxCode(data.code || '');
              setCurrentTab('code');
            }
          },
        onError: (error: Error) => {
          setMessages(prev => [...prev, {role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date()}]);
        }
    });
    const isPending = chatMutation.isPending;

    const initializeSystemPrompts = useCallback(async () => {
        setIsLoadingSystemPrompts(true);
        try {
          const contextData = await fetchGamelabContextData();
          let populatedCoderPrompt = BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT;
          let populatedReviewerPrompt = BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT;
    
          const templateStructuresString = JSON.stringify(contextData.templateStructure || {}, null, 2);
          const querySpecificExamplesString = '(Code examples related to your query will be injected here by the AI if relevant)';
    
          populatedCoderPrompt = populatedCoderPrompt
            .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', templateStructuresString)
            .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', querySpecificExamplesString);
    
          populatedReviewerPrompt = populatedReviewerPrompt
            .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', templateStructuresString)
            .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', querySpecificExamplesString);
    
          setCurrentCoderSystemPrompt(populatedCoderPrompt);
          setBaseCoderTemplateWithContext(populatedCoderPrompt);
          setCurrentReviewerSystemPrompt(populatedReviewerPrompt);
          setBaseReviewerTemplateWithContext(populatedReviewerPrompt);
    
        } catch (err) {
          console.error("Error initializing GameLab system prompts:", err);
          const errorPrompt = (template: string) => template
            .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', 'Error loading templates.')
            .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', '(Query-specific code examples)');
    
          setCurrentCoderSystemPrompt(errorPrompt(BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT));
          setBaseCoderTemplateWithContext(errorPrompt(BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT));
          setCurrentReviewerSystemPrompt(errorPrompt(BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT));
          setBaseReviewerTemplateWithContext(errorPrompt(BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT));
        } finally {
          setIsLoadingSystemPrompts(false);
        }
    }, []);

    useEffect(() => {
        if (language === 'javascript') {
          setCurrentCoderSystemPrompt(BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS);
        } else {
          setCurrentCoderSystemPrompt(baseCoderTemplateWithContext || BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT);
        }
    }, [language, baseCoderTemplateWithContext]);


    useEffect(() => {
        initializeSystemPrompts();
    }, [initializeSystemPrompts]);

    useEffect(() => {
        async function fetchModelsForUser() {
          if (isUserLoaded) {
            setIsLoadingModels(true);
            try {
              let userIsSubscribed = false;
              if (isSignedIn && user?.id) {
                const profileResponse = await fetch(`/api/check-subscription?userId=${user.id}`);
                if (profileResponse.ok) {
                    const profileData = await profileResponse.json();
                    userIsSubscribed = profileData?.subscriptionActive || false;
                }
              }
              setAvailableModels(getAvailableModelsForUser(userIsSubscribed));
            } catch (error) {
              console.error("Failed to fetch available models for GameLabPage:", error);
              setAvailableModels(getAvailableModelsForUser(false));
            } finally {
              setIsLoadingModels(false);
            }
          }
        }
        fetchModelsForUser();
    }, [isUserLoaded, isSignedIn, user]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
    
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'GAMELAB_DATA') {
                console.log('Received data from Sandpack preview:', event.data.payload);
                const { payload } = event.data;

                if (!payload.sessionId || !payload.gameId) {
                    console.error("Received GAMELAB_DATA without a sessionId or gameId. Cannot save.", payload);
                    return;
                }

                fetch('/api/gamelab/sandbox', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save_game_data',
                        data: {
                            sessionId: payload.sessionId,
                            gameId: payload.gameId,
                            roundNumber: payload.roundNumber || 1,
                            roundData: payload
                        }
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (!data.success) {
                        console.error('Failed to save sandbox data:', data.error);
                    } else {
                        setSandpackTestData(prev => [...prev, data.gameData]);
                    }
                })
                .catch(err => console.error('Error sending sandbox data to API:', err));
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputMessage.trim() || isPending) return;
      const userMessage: ChatMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
      setMessages(prev => [...prev, userMessage]);

      const formData = new FormData();
      formData.append('message', inputMessage);
      formData.append('chatHistory', JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))));
      formData.append('language', language);
      if (currentCoderSystemPrompt) formData.append('coderSystemPrompt', currentCoderSystemPrompt);
      if (currentReviewerSystemPrompt) formData.append('reviewerSystemPrompt', currentReviewerSystemPrompt);
      formData.append('useCodeReview', String(useCodeReview));
      if (selectedCoderModel) formData.append('selectedCoderModelId', selectedCoderModel);
      if (selectedReviewerModel) formData.append('selectedReviewerModelId', selectedReviewerModel);
      if (attachedFile) formData.append('asset', attachedFile);

      chatMutation.mutate(formData);

      setInputMessage("");
      setAttachedFile(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setAttachedFile(event.target.files[0]);
        }
    };

    const handleResetCoderSystemPrompt = () => {
        if (language === 'javascript') {
          setCurrentCoderSystemPrompt(BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS);
        } else {
          setCurrentCoderSystemPrompt(baseCoderTemplateWithContext || BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT);
        }
    };
    
    const handleResetReviewerSystemPrompt = () => { 
        if (baseReviewerTemplateWithContext) { 
            setCurrentReviewerSystemPrompt(baseReviewerTemplateWithContext); 
        } else { 
            initializeSystemPrompts(); 
        } 
    };

    const getJsFilesForUpload = (): SandpackFiles => {
        if (language !== 'javascript' || !originalCode) {
            return {};
        }
        return {
            '/game.js': { code: originalCode },
            '/index.html': {
                code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GameLab Sketch</title>
    <style>body,html{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}#game-container{width:100%;height:100%;}</style>
</head>
<body>
    <div id="game-container"></div>
    <script src="game.js"></script>
</body>
</html>`
            },
        };
    };

    return (
        <div className="w-full max-w-7xl h-full flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col bg-gray-50">
                <div className="p-4 bg-emerald-500 text-white flex-shrink-0">
                  <h1 className="text-2xl font-bold">AI Game Lab</h1>
                  <p className="text-sm">Chat to create games for RandomPlayables</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                      <div className="text-gray-500 text-center mt-8">
                        <p>Select a language below, then describe the game you want to create.</p>
                        <div className="mt-4">
                          <p className="text-xs font-semibold mb-2">Try these:</p>
                          {(suggestedPrompts[language as keyof typeof suggestedPrompts] || []).map((prompt, idx) => (
                            <button key={idx} onClick={() => setInputMessage(prompt)} className="block w-full text-left text-xs bg-white p-2 mb-1 rounded border hover:bg-gray-100">
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
                          msg.role === 'user' 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-white border border-gray-200 text-gray-900'
                        }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs mt-1 opacity-70">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                  {isPending && <div className="flex justify-start"><div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm"><Spinner /></div></div>}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t bg-white overflow-auto flex-shrink-0">
                  <form onSubmit={handleSubmit} className="space-y-2">
                      <textarea
                          value={inputMessage} onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isPending && inputMessage.trim()) handleSubmit(e); } }}
                          placeholder="Describe your game idea..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px] text-gray-900"
                          disabled={isPending} rows={3}
                      />
                       <div className="flex items-center space-x-2">
                        <label htmlFor="file-upload" className="cursor-pointer text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md border">
                            Choose File
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isPending}
                        />
                        {attachedFile && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <span>{attachedFile.name}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAttachedFile(null);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }}
                                    className="text-red-500 text-xs"
                                    title="Remove file"
                                >
                                    (clear)
                                </button>
                            </div>
                        )}
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-600">Language</label>
                          <div className="mt-1 flex w-full rounded-md shadow-sm">
                              <button
                                  type="button"
                                  onClick={() => setLanguage('tsx')}
                                  disabled={isPending}
                                  className={`relative inline-flex items-center justify-center w-1/2 rounded-l-md border border-gray-300 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${language === 'tsx' ? 'bg-emerald-500 text-white z-10' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                              >
                                  React/TSX
                              </button>
                              <button
                                  type="button"
                                  onClick={() => setLanguage('javascript')}
                                  disabled={isPending}
                                  className={`relative -ml-px inline-flex items-center justify-center w-1/2 rounded-r-md border border-gray-300 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${language === 'javascript' ? 'bg-emerald-500 text-white z-10' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                              >
                                  Vanilla JS
                              </button>
                          </div>
                      </div>
                      <div>
                          <label htmlFor="modelSelectorCoderGameLab" className="block text-xs font-medium text-gray-600">{useCodeReview ? "Coder Model" : "AI Model"} (Optional)</label>
                          <select id="modelSelectorCoderGameLab" value={selectedCoderModel} onChange={(e) => setSelectedCoderModel(e.target.value)} disabled={isLoadingModels || isPending}
                          className="mt-1 block w-full py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs text-gray-900"
                          >
                          <option value="">-- Use Default --</option>
                          {isLoadingModels ? <option disabled>Loading models...</option> : availableModels.length === 0 ? <option disabled>No models available.</option> : availableModels.map(model => (<option key={model.id} value={model.id}>{model.name}</option>))}
                          </select>
                      </div>
                      {useCodeReview && (
                          <div>
                          <label htmlFor="modelSelectorReviewerGameLab" className="block text-xs font-medium text-gray-600">Reviewer Model (Optional)</label>
                          <select id="modelSelectorReviewerGameLab" value={selectedReviewerModel} onChange={(e) => setSelectedReviewerModel(e.target.value)} disabled={isLoadingModels || isPending}
                              className="mt-1 block w-full py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs text-gray-900"
                          >
                              <option value="">-- Use Default Peer --</option>
                              {isLoadingModels ? <option disabled>Loading models...</option> : availableModels.length === 0 ? <option disabled>No models available.</option> : availableModels.map(model => (<option key={model.id + "-reviewer"} value={model.id}>{model.name}</option>))}
                          </select>
                          </div>
                      )}
                      <div className="flex items-center">
                          <input type="checkbox" id="useCodeReviewGameLab" checked={useCodeReview} onChange={(e) => { setUseCodeReview(e.target.checked); setSelectedCoderModel(""); setSelectedReviewerModel("");}}
                          className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                          />
                          <label htmlFor="useCodeReviewGameLab" className="ml-2 text-sm text-gray-700">Enable AI Code Review (experimental)</label>
                      </div>
                      <div className="flex justify-end">
                          <button type="submit" disabled={isPending} className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50">
                          {isPending ? <Spinner className="w-4 h-4 inline mr-1"/> : null}
                          {isPending ? 'Processing...' : 'Send'}
                          </button>
                      </div>
                      <div className="mt-1 border-t pt-2">
                        <button type="button" onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)} className="text-xs text-gray-500 hover:text-emerald-600">
                            {showSystemPromptEditor ? "Hide System Prompts" : "Show System Prompts"}
                        </button>
                        {showSystemPromptEditor && (
                            <div className="mt-2 space-y-2">
                            {isLoadingSystemPrompts ? <div className="flex items-center text-xs text-gray-500"><Spinner className="w-3 h-3 mr-1" /> Loading...</div> : (<>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">{useCodeReview ? "Coder System Prompt:" : "System Prompt:"}</label>
                                    <textarea value={currentCoderSystemPrompt || ""} onChange={(e) => setCurrentCoderSystemPrompt(e.target.value)}
                                    className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900" placeholder="Coder system prompt..."
                                    />
                                    <div className="flex justify-end mt-1">
                                        <button type="button" onClick={handleResetCoderSystemPrompt} disabled={isLoadingSystemPrompts}
                                        className="text-xs px-2 py-0.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                                        >Reset Coder</button>
                                    </div>
                                </div>
                                {useCodeReview && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Reviewer System Prompt:</label>
                                        <textarea value={currentReviewerSystemPrompt || ""} onChange={(e) => setCurrentReviewerSystemPrompt(e.target.value)}
                                        className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900" placeholder="Reviewer system prompt..."
                                        />
                                        <div className="flex justify-end mt-1">
                                            <button type="button" onClick={handleResetReviewerSystemPrompt} disabled={isLoadingSystemPrompts || !baseReviewerTemplateWithContext}
                                            className="text-xs px-2 py-0.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                                            >Reset Reviewer</button>
                                        </div>
                                    </div>
                                )}</>
                            )}
                            </div>
                        )}
                      </div>
                  </form>
                </div>
            </div>
            
            <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-emerald-700">
                      Game Lab
                    </h2>
                    <div className="flex items-center space-x-2">
                        {language === 'tsx' 
                            ? <><SaveSketchButton files={files} /><GitHubUploadButton files={files} /></>
                            : <><SaveSketchButton files={getJsFilesForUpload()} /><GitHubUploadButton files={getJsFilesForUpload()} /></>
                        }
                    </div>
                </div>

                <div className="flex flex-col flex-grow min-h-0">
                    <div className="mb-4 border-b border-gray-200 flex-shrink-0">
                        <ul className="flex flex-wrap -mb-px">
                            <li className="mr-2">
                                <button 
                                    className={`inline-block p-4 ${currentTab === 'code' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                    onClick={() => setCurrentTab('code')}>
                                    Code Editor
                                </button>
                            </li>
                            <li className="mr-2">
                                <button 
                                    className={`inline-block p-4 ${currentTab === 'sandbox' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                    onClick={() => setCurrentTab('sandbox')}>
                                    Game Preview
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div className="rounded-lg flex flex-col flex-grow min-h-0 relative">
                        {language === 'tsx' ? (
                            <>
                                <div style={{ display: currentTab === 'code' ? 'flex' : 'none', height: '100%', overflow: 'auto' }}>
                                    <SandpackCodeEditor showTabs closableTabs />
                                </div>
                                <div style={{ display: currentTab === 'sandbox' ? 'flex' : 'none' }} className="flex-1 flex-col h-full">
                                    <div className="relative flex-grow">
                                        <SandpackPreview style={{ width: '100%', height: '100%', border: '0' }} />
                                    </div>
                                    {sandpackTestData.length > 0 && (
                                        <div className="p-3 bg-gray-800 text-white text-sm max-h-[150px] overflow-y-auto flex-shrink-0 border-t-2 border-gray-700">
                                            <p className="font-semibold mb-1">Test Data Log (from GameLabSandbox.gamedatas):</p>
                                            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(sandpackTestData, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            currentTab === 'code' ? (
                                originalCode 
                                ? <CodeBlock code={originalCode} language="javascript" /> 
                                : <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Your game code will appear here.</p></div>
                            ) : (
                                <GameSandbox code={sandboxCode} language="javascript" />
                            )
                        )}
                    </div>
                </div>
                
                {codeError && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg text-sm flex-shrink-0">{codeError}</div>}
            </div>
        </div>
    )
}

export default function GameLabPage() {
    return (
        <div className="h-screen p-4 flex flex-col">
            <SandpackProvider template="react-ts" theme="dark" files={defaultFiles}>
                <GamelabWorkspace />
            </SandpackProvider>
        </div>
    );
}