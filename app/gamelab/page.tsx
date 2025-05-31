"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { CodeBlock } from './components/CodeBlock';
import GameSandbox from "./components/GameSandbox";
import SaveSketchButton from './components/SaveSketchButton';
import GitHubUploadButton from './components/GitHubUploadButton';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GameLabApiResponse {
  message: string;
  code?: string;
  language?: string;
  error?: string;
  limitReached?: boolean; // Added for consistency
  remainingRequests?: number; // Added for consistency
}

// Base System Prompt Template for GameLab
// %%GAMELAB_TEMPLATE_STRUCTURES%% for Type A data
// %%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%% for Type B data
const BASE_GAMELAB_SYSTEM_PROMPT_TEMPLATE = `
You are an AI game development assistant for RandomPlayables, a platform for mathematical citizen science games.
Your goal is to help users create games that can be deployed on the RandomPlayables platform.

IMPORTANT REQUIREMENTS FOR ALL GAMES YOU CREATE:
1. Every game MUST be delivered as a COMPLETE single HTML file with:
    - Proper DOCTYPE and HTML structure
    - CSS in a <style> tag in the head
    - JavaScript in a <script> tag before the body closing tag
    - A <div id="game-container"></div> element that the JavaScript code interacts with
2. Interactive elements MUST use standard DOM event listeners.
3. All JavaScript code must reference elements by ID or create elements dynamically.
4. The game should work entirely in a sandbox environment without external dependencies.

AVAILABLE TEMPLATE STRUCTURES (Type A data, already provided):
%%GAMELAB_TEMPLATE_STRUCTURES%%

REAL CODE EXAMPLES FROM EXISTING GAMES (Type B data, provided based on query):
%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%

When designing games based on existing code examples (if provided based on your query):
1. Follow similar patterns for game structure and organization.
2. Use the same approach for connecting to the RandomPlayables platform APIs if applicable.
3. Implement similar data structures for game state and scoring.

When handling platform integration (refer to template or examples):
1. Games might connect to RandomPlayables platform APIs.
2. Use sessionId to track game sessions.
3. Send game data to the platform for scoring and analysis.

Example of a complete, simple HTML game:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Simple Clicker Game</title>
  <style>
    body { display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background: #f0f0f0; }
    #game-container { text-align: center; }
    button { font-size: 20px; padding: 10px 20px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="game-container">
    <h1>Click the Button!</h1>
    <button id="clickerBtn">Click me: <span id="score">0</span></button>
  </div>
  <script>
    let score = 0;
    const scoreDisplay = document.getElementById('score');
    const clickerButton = document.getElementById('clickerBtn');
    clickerButton.addEventListener('click', () => {
      score++;
      scoreDisplay.textContent = score;
      // Example of sending data (if window.sendDataToGameLab is available)
      if(window.sendDataToGameLab) {
        window.sendDataToGameLab({ event: 'click', currentScore: score, timestamp: new Date().toISOString() });
      }
    });
  <\/script>
</body>
</html>
\`\`\`

These games will be deployed on RandomPlayables.com.

When responding:
1. First understand the user's game idea. Ask clarifying questions if needed.
2. Suggest a clear game structure and mechanics.
3. Provide a COMPLETE self-contained HTML file with embedded CSS and JavaScript.
4. Explain how the game would integrate with the RandomPlayables platform if relevant.
5. Ensure your generated code uses the \`game-container\` div if it needs a root element.
`;


// Function to fetch Type A context data for GameLab
async function fetchGamelabContextData() {
  const response = await fetch("/api/gamelab/context-data");
  if (!response.ok) {
    throw new Error('Failed to fetch GameLab context data');
  }
  return response.json();
}


async function sendChatMessageToApi(message: string, chatHistory: ChatMessage[], editedSystemPrompt: string | null) {
  const response = await fetch("/api/gamelab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ 
      message, 
      chatHistory: chatHistory.map(m => ({role: m.role, content: m.content})),
      customSystemPrompt: editedSystemPrompt // Send the user-edited prompt
    })
  });
  return response.json();
}

export default function GameLabPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [currentLanguage, setCurrentLanguage] = useState<string>("html");
  const [currentTab, setCurrentTab] = useState<'code' | 'sandbox'>('code');
  const [codeError, setCodeError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState<string | null>(null); // User-editable
  const [baseTemplateWithContext, setBaseTemplateWithContext] = useState<string | null>(null); // For reset
  const [isLoadingSystemPrompt, setIsLoadingSystemPrompt] = useState(true);
  
  const router = useRouter(); 
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const suggestedPrompts = [
    "Create a number guessing game",
    "I want a simple grid-based puzzle game",
    "Help me design a memory matching game",
    "Make a game about coin flipping statistics",
    "Build a very basic ecosystem simulation"
  ];

  const initializeSystemPrompt = useCallback(async () => {
    setIsLoadingSystemPrompt(true);
    try {
      const contextData = await fetchGamelabContextData(); // Fetches { templateStructure: ... }
      let populatedPrompt = BASE_GAMELAB_SYSTEM_PROMPT_TEMPLATE;
      
      populatedPrompt = populatedPrompt.replace(
        '%%GAMELAB_TEMPLATE_STRUCTURES%%',
        JSON.stringify(contextData.templateStructure || {}, null, 2)
      );
      // Type B placeholder will be resolved by the backend.
      // For user's view, we can put a generic message or clear it.
      populatedPrompt = populatedPrompt.replace(
        '%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%',
        '(Code examples related to your query will be injected here by the AI if relevant)'
      );

      setCurrentSystemPrompt(populatedPrompt);
      setBaseTemplateWithContext(populatedPrompt);
    } catch (err) {
      console.error("Error initializing GameLab system prompt:", err);
      const errorPrompt = BASE_GAMELAB_SYSTEM_PROMPT_TEMPLATE
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', 'Error loading templates.')
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', '(Query-specific code examples)');
      setCurrentSystemPrompt(errorPrompt);
      setBaseTemplateWithContext(errorPrompt);
    } finally {
      setIsLoadingSystemPrompt(false);
    }
  }, []);

  useEffect(() => {
    initializeSystemPrompt();
  }, [initializeSystemPrompt]);
  
  // localStorage state restoration logic (from original file)
   useEffect(() => {
    const githubConnected = searchParams.get('github_connected');
    const shouldRestoreState = localStorage.getItem('gamelab_restore_on_callback') === 'true';

    if (githubConnected === 'true' && shouldRestoreState) {
      const pendingCode = localStorage.getItem('gamelab_pending_code');
      const pendingLanguage = localStorage.getItem('gamelab_pending_language');
      const pendingMessagesString = localStorage.getItem('gamelab_pending_messages');

      if (pendingCode) setCurrentCode(pendingCode);
      if (pendingLanguage) setCurrentLanguage(pendingLanguage);
      if (pendingMessagesString) {
        try {
          const parsedMessages = JSON.parse(pendingMessagesString);
          setMessages(parsedMessages.map((msg: ChatMessage) => ({ ...msg, timestamp: new Date(msg.timestamp) })));
        } catch (e) { console.error("Failed to parse messages from localStorage", e); }
      }

      localStorage.removeItem('gamelab_pending_code');
      localStorage.removeItem('gamelab_pending_language');
      localStorage.removeItem('gamelab_pending_messages');
      localStorage.removeItem('gamelab_restore_on_callback');
      
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('github_connected');
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    }
  }, [searchParams, router, pathname]);


  const { mutate, isPending } = useMutation<GameLabApiResponse, Error, string>({
    mutationFn: (message: string) => sendChatMessageToApi(message, messages, currentSystemPrompt),
    onSuccess: (data: GameLabApiResponse) => {
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.message, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.code) {
        setCurrentCode(data.code);
        setCurrentLanguage(data.language || "html");
        setCurrentTab('code'); 
        setCodeError(null);
      } else if (data.error) {
        setCodeError(data.error);
      } else {
         // No code and no error, might be a clarifying question from AI
        setCodeError(null);
      }
    },
    onError: (error: Error) => {
      setMessages(prev => [...prev, {role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date()}]);
      setCodeError("Failed to communicate with the AI. Please try again.");
    }
  });
  
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isPending) return;
    const userMessage: ChatMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    mutate(inputMessage);
    setInputMessage("");
  };

  const handleResetSystemPrompt = () => {
    if (baseTemplateWithContext) {
      setCurrentSystemPrompt(baseTemplateWithContext);
    } else {
      initializeSystemPrompt(); // Re-fetch if not available
    }
  };
  
  const extractGameTitle = (): string => { /* ... (keep existing implementation from original file) ... */ 
    if (currentCode) {
      const titleMatch = currentCode.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1] && titleMatch[1].trim() !== '') {
        let title = titleMatch[1].trim();
        if (!['Game', 'RandomPlayables Game', 'Untitled', 'Document'].includes(title)) {
          return title;
        }
      }
    }
    const lastAssistantMessage = messages.filter(msg => msg.role === 'assistant').pop();
    if (lastAssistantMessage) {
      const gamePatterns = [
        /(?:created?|built?|made)\s+(?:a\s+)?([^.!?]+?)\s+game/i,
        /(?:this\s+is\s+)?(?:a\s+)?([^.!?]+?)\s+game/i,
        /game\s+called\s+([^.!?]+)/i, /titled\s+([^.!?]+)/i,
        /creating\s+(?:a\s+)?([^.!?]+?)\s+game/i
      ];
      for (const pattern of gamePatterns) {
        const match = lastAssistantMessage.content.match(pattern);
        if (match && match[1]) {
          let title = match[1].trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ');
          title = title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
          if (title.length > 3 && title.length < 50) return title;
        }
      }
    }
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    if (lastUserMessage) {
      const userPatterns = [
        /create\s+(?:a\s+)?([^.!?]+?)\s+game/i, /build\s+(?:a\s+)?([^.!?]+?)\s+game/i,
        /make\s+(?:a\s+)?([^.!?]+?)\s+game/i, /(?:a\s+)?([^.!?]+?)\s+game/i
      ];
      for (const pattern of userPatterns) {
        const match = lastUserMessage.content.match(pattern);
        if (match && match[1]) {
          let title = match[1].trim().replace(/^["']|["']$/g, '');
          title = title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
          if (title.length > 3 && title.length < 50) return title;
        }
      }
    }
    if (currentCode) {
      const codePatterns = [
        { pattern: /guessing|guess/i, title: 'Number Guessing Game' }, { pattern: /memory|match/i, title: 'Memory Game' },
        { pattern: /puzzle|solve/i, title: 'Puzzle Game' }, { pattern: /click|button/i, title: 'Click Game' },
        { pattern: /snake/i, title: 'Snake Game' }, { pattern: /pong/i, title: 'Pong Game' },
        { pattern: /tetris/i, title: 'Tetris Game' }, { pattern: /quiz/i, title: 'Quiz Game' },
        { pattern: /calculator/i, title: 'Calculator Game' }, { pattern: /maze/i, title: 'Maze Game' },
        { pattern: /card/i, title: 'Card Game' }, { pattern: /dice|roll/i, title: 'Dice Game' },
        { pattern: /tic.?tac.?toe/i, title: 'Tic Tac Toe' }, { pattern: /rock.?paper.?scissors/i, title: 'Rock Paper Scissors' }
      ];
      for (const { pattern, title } of codePatterns) {
        if (pattern.test(currentCode)) return title;
      }
    }
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `GameLab Creation ${dateString} ${timeString}`;
  };
  const extractGameDescription = (): string => { /* ... (keep existing implementation from original file) ... */ 
    const lastAssistantMessage = messages.filter(msg => msg.role === 'assistant').pop();
    if (lastAssistantMessage) {
      const sentences = lastAssistantMessage.content.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes('game') && 
            (sentence.toLowerCase().includes('this') || sentence.toLowerCase().includes('creates') || sentence.toLowerCase().includes('allows'))) {
          return sentence.trim() + '.';
        }
      }
    }
    return `A game created with RandomPlayables GameLab. Play directly in your browser!`;
  };
  const downloadCode = () => { /* ... (keep existing implementation from original file) ... */ 
    if (!currentCode) return;
    let extension = "txt";
    let fileContent = currentCode;
    
    if (currentLanguage === "javascript" || currentLanguage === "js") extension = "js";
    else if (currentLanguage === "typescript" || currentLanguage === "ts") extension = "ts";
    else if (currentLanguage === "jsx") extension = "jsx";
    else if (currentLanguage === "tsx") extension = "tsx";
    else if (currentLanguage === "html" || currentCode.includes("<!DOCTYPE html>") || currentCode.includes("<html")) extension = "html";
    
    const fileMatches = currentCode.match(/```\w+\s+\/\/\s+([a-zA-Z0-9_.-]+)\s+([\s\S]*?)```/g);
    if (fileMatches && fileMatches.length > 1) {
      fileContent = "/* GAMELAB MULTI-FILE EXPORT */\n\n" + currentCode;
      extension = "txt";
    }
    
    if (extension === "html") {
      const cssMatch = currentCode.match(/<style>([\s\S]*?)<\/style>/);
      const cssContent = cssMatch ? cssMatch[1].trim() : "";
      const jsMatch = currentCode.match(/<script>([\s\S]*?)<\/script>/);
      const jsContent = jsMatch ? jsMatch[1].trim() : "";
      
      if (cssContent.length > 100 || jsContent.length > 100) {
        fileContent = "/* GAMELAB HTML PROJECT */\n\n" +
          "/* index.html */\n" + currentCode + "\n\n" +
          (cssContent ? "/* styles.css */\n" + cssContent + "\n\n" : "") +
          (jsContent ? "/* game.js */\n" + jsContent : "");
        extension = "txt";
      }
    }
    
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-code-${new Date().toISOString()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const downloadTranscript = () => { /* ... (keep existing implementation from original file) ... */ 
    const transcript = messages.map(msg => 
      `${msg.role.toUpperCase()} [${msg.timestamp.toLocaleTimeString()}]: ${msg.content}`
    ).join('\n\n');
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gamelab-transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const clearChat = () => { /* ... (keep existing implementation from original file) ... */ 
    if (window.confirm("Are you sure you want to clear the chat? This will delete all messages and code.")) {
      setMessages([]);
      setCurrentCode("");
      setCurrentLanguage("html");
      setCodeError(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Left Panel: Chat Interface */}
        <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[700px] bg-gray-50">
          <div className="p-4 bg-emerald-500 text-white">
            <h1 className="text-2xl font-bold">AI Game Lab</h1>
            <p className="text-sm">Chat to create games for RandomPlayables</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-gray-500 text-center mt-8">
                <p>Describe the game you want to create.</p>
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2">Try these:</p>
                  {suggestedPrompts.map((prompt, idx) => (
                    <button key={idx} onClick={() => setInputMessage(prompt)} className="block w-full text-left text-xs bg-white p-2 mb-1 rounded border hover:bg-gray-100">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">{msg.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
            {isPending && <div className="flex justify-start"><div className="bg-white border border-gray-200 p-3 rounded-lg"><Spinner /></div></div>}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
            <div className="flex flex-col space-y-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isPending && inputMessage.trim()) handleSubmit(e); }}}
                placeholder="Describe your game idea..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                disabled={isPending}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={isPending} className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50">Send</button>
              </div>
            </div>
            <div className="mt-2">
              <button type="button" onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)} className="text-xs text-gray-500 hover:text-emerald-600">
                {showSystemPromptEditor ? "Hide System Prompt" : "Show System Prompt"}
              </button>
              {showSystemPromptEditor && (
                <div className="mt-2">
                  {isLoadingSystemPrompt ? (
                    <div className="flex items-center text-xs text-gray-500"><Spinner className="w-3 h-3 mr-1" /> Loading default prompt...</div>
                  ) : (
                    <textarea
                      value={currentSystemPrompt || ""}
                      onChange={(e) => setCurrentSystemPrompt(e.target.value)}
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="System prompt..."
                    />
                  )}
                  <div className="flex justify-end mt-1 space-x-2">
                    <button type="button" onClick={handleResetSystemPrompt} disabled={isLoadingSystemPrompt || !baseTemplateWithContext} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">
                      Reset to Default
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
        
        {/* Right Panel: Code Editor, Sandbox, Controls */}
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-emerald-700">Game Lab Workspace</h2>
            <div className="space-x-2">
              <button onClick={clearChat} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Clear</button>
              {currentCode && <SaveSketchButton code={currentCode} language={currentLanguage} />}
              <GitHubUploadButton gameTitle={extractGameTitle()} gameCode={currentCode} gameDescription={extractGameDescription()} currentLanguage={currentLanguage} messages={messages} />
              <button onClick={downloadTranscript} className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600">Transcript</button>
              {currentCode && <button onClick={downloadCode} className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600">Code</button>}
            </div>
          </div>
          
          <div className="mb-4 border-b border-gray-200">
            <ul className="flex flex-wrap -mb-px">
              <li className="mr-2">
                <button className={`inline-block p-4 ${currentTab === 'code' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setCurrentTab('code')}>
                  Code Editor
                </button>
              </li>
              <li className="mr-2">
                <button className={`inline-block p-4 ${currentTab === 'sandbox' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setCurrentTab('sandbox')}>
                  Game Preview
                </button>
              </li>
            </ul>
          </div>
          
          <div className="mb-6 rounded-lg min-h-[400px] flex flex-col">
            {currentTab === 'code' ? (
              currentCode ? <CodeBlock code={currentCode} language={currentLanguage} /> : <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Your game code will appear here.</p></div>
            ) : (
              <GameSandbox code={currentCode} language={currentLanguage} />
            )}
          </div>
          
          {codeError && <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{codeError}</div>}
        </div>
      </div>
    </div>
  );
}