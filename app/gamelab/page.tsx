"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { CodeBlock } from './components/CodeBlock';
import GameSandbox from "./components/GameSandbox";
import SaveSketchButton from './components/SaveSketchButton';
import GitHubUploadButton from './components/GitHubUploadButton';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUser } from "@clerk/nextjs";
import { ModelDefinition, getAvailableModelsForUser } from "@/lib/modelConfig";

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
  limitReached?: boolean;
  remainingRequests?: number;
}

const reactTsxExample = `
// Example of a simple App.tsx component:
import React, { useState, useEffect } from 'react';

// Define a simple CSS style string or suggest a separate CSS file.
const appStyles = \`
  .container {
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    background-color: #f0f8ff;
    padding: 20px;
    border-radius: 10px;
  }
  .title {
    color: #333;
  }
  .button {
    background-color: #10B981; /* emerald-500 */
    color: white;
    padding: 10px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
  }
  .button:hover {
    background-color: #059669; /* emerald-600 */
  }
  .gameArea {
    width: 300px;
    height: 200px;
    border: 1px solid #ccc;
    margin-top: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
\`;

// Main App component
const App: React.FC = () => {
  const [score, setScore] = useState<number>(0);

  useEffect(() => {
    console.log("GameLab React Sketch Initialized!");
    if (window.sendDataToGameLab) {
      window.sendDataToGameLab({ event: 'game_started', time: new Date().toISOString() });
    }
  }, []);

  const handlePlayerAction = () => {
    const newScore = score + 10;
    setScore(newScore);
    if (window.sendDataToGameLab) {
      window.sendDataToGameLab({ event: 'player_action', newScore, time: new Date().toISOString() });
    }
  };

  return (
    <>
      <style>{appStyles}</style>
      <div className="container">
        <h1 className="title">My Awesome React Game</h1>
        <p>Score: {score}</p>
        <button onClick={handlePlayerAction} className="button">
          Perform Action
        </button>
        <div className="gameArea">
          <p>Game Content Here</p>
        </div>
      </div>
    </>
  );
};
// Ensure App is available for GameSandbox to render
// export default App; // Or ensure GameSandbox renders it correctly if not default exported
`;

const BASE_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI game development assistant for RandomPlayables. Your primary goal is to generate self-contained, runnable game code based on user requests, suitable for the GameLab sandbox environment.

Key Instructions:
1.  **Output Format:** Primarily, you should generate code for a single \`App.tsx\` file (React with TypeScript). This component will be rendered in the GameLab sandbox.
    Alternatively, for very simple games or if the user specifically requests it, you can provide a single HTML file with embedded JavaScript and CSS.
2.  **React/TSX Sketches (\`App.tsx\`):**
    * The main React component MUST be named \`App\`.
    * Use functional components with hooks (e.g., \`useState\`, \`useEffect\`).
    * Include basic inline CSS via a \`<style>\` tag within the TSX, or define styles as JavaScript objects if simple enough. Avoid complex CSS setups for sketches.
    * Ensure the sketch is self-contained within this single \`App.tsx\` structure.
    * **Sandbox Interaction:** If the game involves sending data (e.g., scores, events), use \`window.sendDataToGameLab({ your_data_here })\`. Check for its existence first: \`if (typeof window.sendDataToGameLab === 'function') { ... }\`.
    * The GameLab sandbox injects \`GAMELAB_SESSION_ID\` into the window scope. You can use this if needed: \`console.log("Session ID:", window.GAMELAB_SESSION_ID);\`.
3.  **HTML/JS/CSS Games:**
    * Provide a complete, single HTML file.
    * Embed JavaScript within \`<script>\` tags and CSS within \`<style>\` tags.
    * Keep it simple and self-contained.
4.  **Code Structure and Clarity:**
    * Write clean, readable, and well-commented code, especially for more complex logic.
    * For TSX, ensure proper typing.
5.  **User Prompts:** Interpret user requests for game ideas, mechanics, or themes, and translate them into a functional sketch.
6.  **Iterative Development:** If the user provides existing code or asks for modifications, work with that, adhering to the sandbox constraints.
7.  **Error Handling (Basic):** For sketches, include basic console logs for key events or errors to help with debugging in the sandbox.
8.  **No External Dependencies (unless explicitly part of a standard HTML/JS browser environment or React for TSX):** Do not assume external libraries are available unless they are standard browser APIs (like \`Math\`, \`Date\`) or React/ReactDOM for TSX.

Available Game Code Examples (for context, structure, or inspiration if relevant to the query):
%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%

Available GameLab Template Structures (primarily for React/TSX sketches):
%%GAMELAB_TEMPLATE_STRUCTURES%%

Focus on generating the code block directly. If explanations are needed, keep them brief and separate from the main code block.
If providing TSX, ensure the main component is \`App\`.
If providing HTML, ensure it's a full, runnable document.
Return ONLY the code required.
EXAMPLE OF A SIMPLE REACT + TYPESCRIPT GAME SKETCH COMPONENT (\`App.tsx\`):
\`\`\`tsx
${reactTsxExample}
\`\`\`
`;

const BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI expert in game development, specializing in simple browser-based games using HTML, CSS, and JavaScript, or React with TypeScript (TSX) for game sketches intended for a sandbox environment.
Your task is to review game code generated by another AI assistant. The initial AI was given a user's query and a system prompt.
Focus your review on:
1.  **Correctness & Functionality:** Does the code run? Does the game function as described or implied by the user's query? Are there obvious bugs?
2.  **Code Quality:** Is the code well-structured, readable, and maintainable? (For React/TSX: Are components well-defined? Is state management appropriate?)
3.  **Game Design Principles:** Is the game concept clear? Is there a basic objective or interaction? Is it potentially engaging for a simple sketch?
4.  **Adherence to Requirements:** (If React/TSX sketch for GameLab Sandbox) Is the main component named \`App\`? Does it seem compatible with a sandbox environment that might inject functions like \`window.sendDataToGameLab\`?
5.  **Completeness:** Does the code provide a complete, runnable example, or are critical parts missing?
6.  **Security & Performance (Basic):** Are there any obvious, glaring security issues or performance bottlenecks for a simple browser game?

Provide constructive feedback. Be specific. If you identify issues or areas for improvement, explain them and suggest concrete changes or fixes. Remember the context is often for quick sketches or simple games.
Return only your review of the game code.
`;


async function fetchGamelabContextData() {
  const response = await fetch("/api/gamelab/context-data");
  if (!response.ok) {
    throw new Error('Failed to fetch GameLab context data');
  }
  return response.json();
}

async function sendChatMessageToApi(
    message: string,
    chatHistory: ChatMessage[],
    coderSystemPrompt: string | null, // Updated
    reviewerSystemPrompt: string | null, // New
    useCodeReview: boolean,
    selectedCoderModelId?: string,
    selectedReviewerModelId?: string
) {
  const response = await fetch("/api/gamelab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ 
      message, 
      chatHistory: chatHistory.map((m: ChatMessage) => ({role: m.role, content: m.content})),
      coderSystemPrompt, // Updated
      reviewerSystemPrompt, // New
      useCodeReview,
      selectedCoderModelId,
      selectedReviewerModelId
    })
  });
  return response.json();
}

export default function GameLabPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [currentLanguage, setCurrentLanguage] = useState<string>("tsx");
  const [currentTab, setCurrentTab] = useState<'code' | 'sandbox'>('code');
  const [codeError, setCodeError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [currentCoderSystemPrompt, setCurrentCoderSystemPrompt] = useState<string | null>(null); // Renamed
  const [currentReviewerSystemPrompt, setCurrentReviewerSystemPrompt] = useState<string | null>(null); // New
  const [baseCoderTemplateWithContext, setBaseCoderTemplateWithContext] = useState<string | null>(null); // Renamed
  const [baseReviewerTemplateWithContext, setBaseReviewerTemplateWithContext] = useState<string | null>(null); // New
  const [isLoadingSystemPrompts, setIsLoadingSystemPrompts] = useState(true); // Combined
  const [useCodeReview, setUseCodeReview] = useState<boolean>(false);
  
  const router = useRouter(); 
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { user, isSignedIn, isLoaded: isUserLoaded } = useUser();
  const [selectedCoderModel, setSelectedCoderModel] = useState<string>("");
  const [selectedReviewerModel, setSelectedReviewerModel] = useState<string>(""); 
  const [availableModels, setAvailableModels] = useState<ModelDefinition[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  const suggestedPrompts = [
    "Create a number guessing game as a React/TSX sketch",
    "I want a simple grid-based puzzle game in React/TSX for the sandbox",
    "Help me design a memory matching game (React/TSX sketch)",
    "Make a game about coin flipping statistics (React/TSX sketch)",
    "Build a very basic ecosystem simulation (React/TSX sketch)"
  ];

  const initializeSystemPrompts = useCallback(async () => { // Renamed
    setIsLoadingSystemPrompts(true);
    try {
      const contextData = await fetchGamelabContextData();
      let populatedCoderPrompt = BASE_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE;
      let populatedReviewerPrompt = BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE;
      
      const templateStructuresString = JSON.stringify(contextData.templateStructure || {}, null, 2);
      const querySpecificExamplesString = '(Code examples related to your query will be injected here by the AI if relevant)';

      [populatedCoderPrompt, populatedReviewerPrompt].forEach((_, index) => {
        let prompt = index === 0 ? populatedCoderPrompt : populatedReviewerPrompt;
        prompt = prompt.replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', templateStructuresString);
        prompt = prompt.replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', querySpecificExamplesString);
        if (index === 0) populatedCoderPrompt = prompt;
        else populatedReviewerPrompt = prompt;
      });
      
      setCurrentCoderSystemPrompt(populatedCoderPrompt);
      setBaseCoderTemplateWithContext(populatedCoderPrompt);
      setCurrentReviewerSystemPrompt(populatedReviewerPrompt);
      setBaseReviewerTemplateWithContext(populatedReviewerPrompt);

    } catch (err) {
      console.error("Error initializing GameLab system prompts:", err);
      const errorPrompt = (template: string) => template
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', 'Error loading templates.')
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', '(Query-specific code examples)');

      setCurrentCoderSystemPrompt(errorPrompt(BASE_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE));
      setBaseCoderTemplateWithContext(errorPrompt(BASE_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE));
      setCurrentReviewerSystemPrompt(errorPrompt(BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE));
      setBaseReviewerTemplateWithContext(errorPrompt(BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE));
    } finally {
      setIsLoadingSystemPrompts(false);
    }
  }, []);

  useEffect(() => {
    initializeSystemPrompts();
  }, [initializeSystemPrompts]);
  
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
          const parsedMessages = JSON.parse(pendingMessagesString) as ChatMessage[];
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

  const { mutate, isPending } = useMutation<GameLabApiResponse, Error, {message: string, useCodeReview: boolean, selectedCoderModelId?: string, selectedReviewerModelId?: string}>({
    mutationFn: (vars) => sendChatMessageToApi(vars.message, messages, currentCoderSystemPrompt, currentReviewerSystemPrompt, vars.useCodeReview, vars.selectedCoderModelId, vars.selectedReviewerModelId),
    onSuccess: (data: GameLabApiResponse) => {
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.message, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.code) {
        setCurrentCode(data.code);
        setCurrentLanguage(data.language || "tsx"); 
        setCurrentTab('code'); 
        setCodeError(null);
      } else if (data.error) {
        setCodeError(data.error);
      } else {
        setCodeError(null); 
      }
    },
    onError: (error: Error) => {
      setMessages(prev => [...prev, {role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date()}]);
      setCodeError("Failed to communicate with the AI. Please try again.");
    }
  });
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isPending) return;
    const userMessage: ChatMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    mutate({
        message: inputMessage, 
        useCodeReview: useCodeReview, 
        selectedCoderModelId: selectedCoderModel || undefined,
        selectedReviewerModelId: useCodeReview && selectedReviewerModel ? (selectedReviewerModel || undefined) : undefined
    });
    setInputMessage("");
  };

  const handleResetCoderSystemPrompt = () => {
    if (baseCoderTemplateWithContext) {
      setCurrentCoderSystemPrompt(baseCoderTemplateWithContext);
    } else {
      initializeSystemPrompts();
    }
  };

  const handleResetReviewerSystemPrompt = () => {
    if (baseReviewerTemplateWithContext) {
      setCurrentReviewerSystemPrompt(baseReviewerTemplateWithContext);
    } else {
      initializeSystemPrompts();
    }
  };
  
  const extractGameTitle = (): string => { 
    if (currentCode) {
      const titleMatch = currentCode.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1] && titleMatch[1].trim() !== '') {
        let title = titleMatch[1].trim();
        if (!['Game', 'RandomPlayables Game', 'Untitled', 'Document', 'GameLab Sandbox', 'Game Preview'].includes(title)) {
          return title;
        }
      }
      const h1Match = currentCode.match(/<h1[^>]*>(.*?)<\/h1>/i);
       if (h1Match && h1Match[1] && h1Match[1].trim() !== '') {
         let h1Title = h1Match[1].trim();
         if (h1Title.toLowerCase().includes("game")) return h1Title;
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
          if (title.length > 3 && title.length < 50 && !title.toLowerCase().includes("example")) return title;
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
           if (title.length > 3 && title.length < 50 && !title.toLowerCase().includes("example")) return title;
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
        if (pattern.test(currentCode) || (lastUserMessage && pattern.test(lastUserMessage.content))) return title;
      }
    }
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `GameLab Sketch ${timeString}`;
  };

  const extractGameDescription = (): string => { 
    const lastAssistantMessage = messages.filter(msg => msg.role === 'assistant').pop();
    if (lastAssistantMessage) {
        const sentences = lastAssistantMessage.content.split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s/);
        for (let sentence of sentences) {
            sentence = sentence.trim();
            if (sentence.length > 20 && sentence.length < 200 && 
                (sentence.toLowerCase().includes('game') || sentence.toLowerCase().includes('sketch') || sentence.toLowerCase().includes('application')) &&
                (sentence.toLowerCase().includes('this is') || sentence.toLowerCase().includes('creates') || sentence.toLowerCase().includes('allows') || sentence.toLowerCase().includes('features') || sentence.toLowerCase().includes('you can'))) {
                return sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?') ? sentence : sentence + '.';
            }
        }
        if (lastAssistantMessage.content.length > 20) {
            return lastAssistantMessage.content.substring(0, 150) + "...";
        }
    }
    return `A game sketch created with RandomPlayables GameLab. Language: ${currentLanguage}.`;
  };

  const downloadCode = () => { 
    if (!currentCode) return;
    let extension = "txt";
    let fileContent = currentCode;
    const detectedLanguage = currentLanguage.toLowerCase();

    if (detectedLanguage === "javascript" || detectedLanguage === "js") extension = "js";
    else if (detectedLanguage === "typescript" || detectedLanguage === "ts") extension = "ts";
    else if (detectedLanguage === "jsx") extension = "jsx";
    else if (detectedLanguage === "tsx") extension = "tsx";
    else if (detectedLanguage === "html" || currentCode.includes("<!DOCTYPE html>") || currentCode.includes("<html")) extension = "html";
    else if (detectedLanguage === "css") extension = "css";
    else if (detectedLanguage === "json") extension = "json";
    else if (detectedLanguage === "python" || detectedLanguage === "py") extension = "py";
    
    const fileSeparatorRegex = /^\/\*\s*FILE:\s*([a-zA-Z0-9_.-]+)\s*\*\/\s*$/gm;
    let lastIndex = 0;
    const files = [];
    let matchFs;
    while ((matchFs = fileSeparatorRegex.exec(currentCode)) !== null) {
        if (files.length > 0) {
            files[files.length - 1].content = currentCode.substring(lastIndex, matchFs.index).trim();
        }
        files.push({ name: matchFs[1], content: ""});
        lastIndex = matchFs.index + matchFs[0].length;
    }
    if (files.length > 0) { 
        files[files.length - 1].content = currentCode.substring(lastIndex).trim();
        fileContent = "/* GAMELAB MULTI-FILE EXPORT (raw) */\n\n" + currentCode;
        extension = "txt"; 
    } else if (currentCode.startsWith("```") && currentCode.match(/```\w+\s+\/\/\s*([a-zA-Z0-9_.-]+)/)) {
        fileContent = "/* GAMELAB EXPORT (from code block) */\n\n" + currentCode;
        extension = "txt";
    }

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    let filename = `gamelab-code-${new Date().toISOString()}.${extension}`;
    const gameTitle = extractGameTitle().replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (gameTitle && gameTitle !== "gamelab_creation" && gameTitle.length > 3) {
        filename = `${gameTitle}.${extension}`;
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTranscript = () => { 
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

  const clearChat = () => { 
    if (window.confirm("Are you sure you want to clear the chat? This will delete all messages and code.")) {
      setMessages([]);
      setCurrentCode("");
      setCurrentLanguage("tsx");
      setCodeError(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[calc(100vh-4rem)] max-h-[800px] bg-gray-50">
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
                <div className={`max-w-[80%] p-3 rounded-lg shadow-sm ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {isPending && <div className="flex justify-start"><div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm"><Spinner /></div></div>}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
            <div className="flex flex-col space-y-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isPending && inputMessage.trim()) handleSubmit(e);
                  }
                }}
                placeholder="Describe your game idea..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                disabled={isPending}
                rows={3}
              />
              <div className="mt-2">
                <label htmlFor="modelSelectorCoderGameLab" className="block text-xs font-medium text-gray-600">
                  {useCodeReview ? "Coder Model" : "AI Model"} (Optional)
                </label>
                <select
                  id="modelSelectorCoderGameLab"
                  value={selectedCoderModel}
                  onChange={(e) => setSelectedCoderModel(e.target.value)}
                  disabled={isLoadingModels || isPending}
                  className="mt-1 block w-full py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs"
                >
                  <option value="">-- Use Default --</option>
                  {isLoadingModels ? (
                    <option disabled>Loading models...</option>
                  ) : availableModels.length === 0 ? (
                     <option disabled>No models available.</option>
                  ) : (
                    availableModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {useCodeReview && (
                <div className="mt-2">
                  <label htmlFor="modelSelectorReviewerGameLab" className="block text-xs font-medium text-gray-600">
                    Reviewer Model (Optional)
                  </label>
                  <select
                    id="modelSelectorReviewerGameLab"
                    value={selectedReviewerModel}
                    onChange={(e) => setSelectedReviewerModel(e.target.value)}
                    disabled={isLoadingModels || isPending}
                    className="mt-1 block w-full py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs"
                  >
                    <option value="">-- Use Default Peer --</option>
                     {isLoadingModels ? (
                       <option disabled>Loading models...</option>
                     ) : availableModels.length === 0 ? (
                       <option disabled>No models available.</option>
                     ) : (
                       availableModels.map(model => (
                         <option key={model.id + "-reviewer"} value={model.id}>
                           {model.name}
                         </option>
                       ))
                     )}
                  </select>
                </div>
              )}
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  id="useCodeReviewGameLab"
                  checked={useCodeReview}
                  onChange={(e) => {
                      setUseCodeReview(e.target.checked);
                      setSelectedCoderModel(""); 
                      setSelectedReviewerModel("");
                  }}
                  className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="useCodeReviewGameLab" className="ml-2 text-sm text-gray-700">
                  Enable AI Code Review (experimental)
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={isPending} className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50">
                  {isPending ? <Spinner className="w-4 h-4 inline mr-1"/> : null}
                  {isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
            <div className="mt-3 border-t pt-3 space-y-1">
              <button type="button" onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)} className="text-xs text-gray-600 hover:text-emerald-700 font-medium">
                {showSystemPromptEditor ? "▼ Hide System Prompts" : "▶ Show System Prompts"}
              </button>
              {showSystemPromptEditor && (
                <div className="mt-1 space-y-3">
                  {isLoadingSystemPrompts ? (
                    <div className="flex items-center text-xs text-gray-500"><Spinner className="w-3 h-3 mr-1" /> Loading default prompts...</div>
                  ) : (
                    <>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            {useCodeReview ? "Coder System Prompt:" : "System Prompt:"}
                        </label>
                        <textarea
                        value={currentCoderSystemPrompt || ""}
                        onChange={(e) => setCurrentCoderSystemPrompt(e.target.value)}
                        className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Coder system prompt..."
                        />
                        <div className="flex justify-end mt-1">
                            <button
                                type="button"
                                onClick={handleResetCoderSystemPrompt}
                                disabled={isLoadingSystemPrompts || !baseCoderTemplateWithContext}
                                className="text-xs px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                                Reset Coder
                            </button>
                        </div>
                    </div>

                    {useCodeReview && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Reviewer System Prompt:
                            </label>
                            <textarea
                            value={currentReviewerSystemPrompt || ""}
                            onChange={(e) => setCurrentReviewerSystemPrompt(e.target.value)}
                            className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Reviewer system prompt..."
                            />
                            <div className="flex justify-end mt-1">
                                <button
                                    type="button"
                                    onClick={handleResetReviewerSystemPrompt}
                                    disabled={isLoadingSystemPrompts || !baseReviewerTemplateWithContext}
                                    className="text-xs px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                                >
                                    Reset Reviewer
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
        
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white flex flex-col h-[calc(100vh-4rem)] max-h-[800px]">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-emerald-700">Game Lab Workspace</h2>
            <div className="space-x-2">
              <button onClick={clearChat} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Clear</button>
              {currentCode && <SaveSketchButton code={currentCode} language={currentLanguage} />}
              <GitHubUploadButton gameTitle={extractGameTitle()} gameCode={currentCode} gameDescription={extractGameDescription()} currentLanguage={currentLanguage} messages={messages} />
              <button onClick={downloadTranscript} className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600">Transcript</button>
              {currentCode && <button onClick={downloadCode} className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600">Code</button>}
            </div>
          </div>
          
          <div className="mb-4 border-b border-gray-200 flex-shrink-0">
            <ul className="flex flex-wrap -mb-px">
              <li className="mr-2">
                <button className={`inline-block p-4 ${currentTab === 'code' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setCurrentTab('code')}>
                  Code Editor
                </button>
              </li>
              <li className="mr-2">
                <button className={`inline-block p-4 ${currentTab === 'sandbox' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setCurrentTab('sandbox')}>
                  Game Preview
                </button>
              </li>
            </ul>
          </div>
          
          <div className="rounded-lg flex flex-col flex-grow min-h-0"> 
            {currentTab === 'code' ? (
              currentCode ? <CodeBlock code={currentCode} language={currentLanguage} /> : <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Your game code will appear here.</p></div>
            ) : (
              <GameSandbox code={currentCode} language={currentLanguage} />
            )}
          </div>
          
          {codeError && <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 flex-shrink-0">{codeError}</div>}
        </div>
      </div>
    </div>
  );
}