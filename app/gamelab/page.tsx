"use client"

import { Spinner } from "@/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { CodeBlock } from './components/CodeBlock';
import GameSandbox from "./components/GameSandbox";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GameLabResponse {
  message: string;
  code?: string;
  language?: string;
  error?: string;
}

interface SavedGameProject {
  id: string;
  name: string;
  code: string;
  language: string;
  timestamp: Date;
}

async function sendChatMessage(message: string, chatHistory: ChatMessage[]) {
  const response = await fetch("/api/gamelab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ message, chatHistory })
  });
  
  return response.json();
}

async function fetchSandboxGames() {
  const response = await fetch("/api/gamelab/sandbox?action=get_games");
  return response.json();
}

export default function GameLabPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [currentLanguage, setCurrentLanguage] = useState<string>("javascript");
  const [currentTab, setCurrentTab] = useState<'code' | 'sandbox'>('code');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedGameProject[]>([]);
  const [savedProjectName, setSavedProjectName] = useState<string>("");
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch saved games from the sandbox
  const { data: savedGamesData, isLoading: isSavedGamesLoading } = useQuery({
    queryKey: ['sandboxGames'],
    queryFn: fetchSandboxGames,
    enabled: true // Always fetch saved games
  });
  
  // Update savedProjects state when data is fetched
  useEffect(() => {
    if (savedGamesData?.success && savedGamesData.games) {
      // Transform the data into our SavedGameProject format
      const transformedGames = savedGamesData.games.map((game: any) => ({
        id: game.id,
        name: game.name,
        // Since the API doesn't store code directly, we'll use placeholders
        code: game.code || "// Code not available in API response",
        language: game.language || "javascript",
        timestamp: new Date(game.createdAt)
      }));
      
      setSavedProjects(transformedGames);
    }
  }, [savedGamesData]);
  
  const { mutate, isPending } = useMutation({
    mutationFn: (message: string) => sendChatMessage(message, messages),
    onSuccess: (data: GameLabResponse) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.code) {
        setCurrentCode(data.code);
        setCurrentLanguage(data.language || "javascript");
        // Automatically switch to code tab when we get new code
        setCurrentTab('code');
      }
      
      if (data.error) {
        setCodeError(data.error);
      } else {
        setCodeError(null);
      }
    },
    onError: (error: Error) => {
      console.error("Error:", error);
      setCodeError("Failed to communicate with the AI assistant. Please try again.");
    }
  });
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    mutate(inputMessage);
    setInputMessage("");
  };
  
  const fetchGameTemplates = async () => {
    try {
      const response = await fetch("/api/gamelab/suggestions");
      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error("Error fetching templates:", error);
      return [
        "Create a simple number guessing game",
        "Help me build a word puzzle game",
        "I want to make a memory matching game",
        "Can you create a probability-based game like Gotham Loops?"
      ];
    }
  };
  
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "Create a simple number guessing game",
    "Help me build a word puzzle game",
    "I want to make a memory matching game",
    "Can you create a probability-based game like Gotham Loops?"
  ]);
  
  useEffect(() => {
    fetchGameTemplates().then(setSuggestedPrompts);
  }, []);
  
  const downloadCode = () => {
    if (!currentCode) return;
    
    const extension = currentLanguage === "javascript" ? "js" : 
                      currentLanguage === "typescript" ? "ts" :
                      currentLanguage === "jsx" ? "jsx" :
                      currentLanguage === "tsx" ? "tsx" : "txt";
    
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-code-${new Date().toISOString()}.${extension}`;
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
  
  const saveProject = async () => {
    if (!currentCode) {
      setProjectNameError("No code to save");
      return;
    }
    
    if (!savedProjectName.trim()) {
      setProjectNameError("Please enter a project name");
      return;
    }
    
    // Reset any previous errors
    setProjectNameError(null);
    
    try {
      // Create a new game entry in the sandbox
      const response = await fetch('/api/gamelab/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_game',
          data: {
            name: savedProjectName,
            description: 'Created in GameLab',
            code: currentCode,
            language: currentLanguage,
            link: '/gamelab/sandbox' // Placeholder link
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Add the saved project to our local state
        const newProject: SavedGameProject = {
          id: data.game.id,
          name: savedProjectName,
          code: currentCode,
          language: currentLanguage,
          timestamp: new Date()
        };
        
        setSavedProjects(prev => [newProject, ...prev]);
        setSavedProjectName(""); // Reset input
        
        // Refetch the saved games to ensure we have the latest data
        // This would be triggered by the queryClient.invalidateQueries call
        // if we were using React Query properly for this
      } else {
        setProjectNameError("Failed to save project");
      }
    } catch (error) {
      console.error("Error saving project:", error);
      setProjectNameError("Error saving project");
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
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-gray-500 text-center mt-8">
                <p>Welcome to GameLab! Describe the game you want to create.</p>
                <p className="text-sm mt-2">I'll help you turn your idea into a playable game.</p>
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2">Try these:</p>
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputMessage(prompt)}
                      className="block w-full text-left text-xs bg-white p-2 mb-1 rounded border hover:bg-gray-100"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white border border-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-lg">
                  <Spinner />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Describe your game idea..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
        
        {/* Right Panel: Code and Preview */}
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-emerald-700">Game Lab</h2>
            <div className="space-x-2">
              <button
                onClick={downloadTranscript}
                className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Download Transcript
              </button>
              {currentCode && (
                <button
                  onClick={downloadCode}
                  className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                >
                  Download Code
                </button>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div className="mb-4 border-b border-gray-200">
            <ul className="flex flex-wrap -mb-px">
              <li className="mr-2">
                <button
                  className={`inline-block p-4 ${
                    currentTab === 'code'
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setCurrentTab('code')}
                >
                  Code Editor
                </button>
              </li>
              <li className="mr-2">
                <button
                  className={`inline-block p-4 ${
                    currentTab === 'sandbox'
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setCurrentTab('sandbox')}
                >
                  Game Preview
                </button>
              </li>
            </ul>
          </div>
          
          {/* Tab Content */}
          <div className="mb-6 rounded-lg min-h-[400px] flex flex-col">
            {currentTab === 'code' ? (
              <>
                {/* Save Project Form */}
                <div className="mb-4 flex space-x-2">
                  <input
                    type="text"
                    value={savedProjectName}
                    onChange={(e) => setSavedProjectName(e.target.value)}
                    placeholder="Enter project name to save"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={saveProject}
                    disabled={!currentCode || !savedProjectName.trim()}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Save Project
                  </button>
                </div>
                {projectNameError && (
                  <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                    {projectNameError}
                  </div>
                )}
                
                {/* Code Display */}
                {currentCode ? (
                  <CodeBlock code={currentCode} language={currentLanguage} />
                ) : (
                  <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center">
                    <p className="text-gray-500">Your game code will appear here</p>
                  </div>
                )}
              </>
            ) : (
              // Game Sandbox Tab
              <GameSandbox 
                code={currentCode} 
                language={currentLanguage} 
              />
            )}
          </div>
          
          {/* Error display */}
          {codeError && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
              {codeError}
            </div>
          )}
          
          {/* Saved Projects Section */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Your Saved Games</h3>
            {isSavedGamesLoading ? (
              <div className="flex items-center">
                <Spinner />
                <span className="ml-2">Loading saved games...</span>
              </div>
            ) : savedProjects.length > 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                <ul className="space-y-2">
                  {savedProjects.map((project) => (
                    <li 
                      key={project.id} 
                      className="flex justify-between items-center p-2 bg-white rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-semibold">{project.name}</p>
                        <p className="text-xs text-gray-500">
                          {project.timestamp.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-x-2">
                        <button 
                          className="px-2 py-1 text-xs bg-emerald-500 text-white rounded"
                          onClick={() => {
                            // Load this project's code
                            setCurrentCode(project.code);
                            setCurrentLanguage(project.language);
                            setCurrentTab('code');
                          }}
                        >
                          Edit
                        </button>
                        <button 
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                          onClick={() => {
                            // Load and test this project
                            setCurrentCode(project.code);
                            setCurrentLanguage(project.language);
                            setCurrentTab('sandbox');
                          }}
                        >
                          Test
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-gray-500">No saved games yet. Create and save a game to see it here!</p>
            )}
          </div>
          
          {/* Instructions */}
          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-emerald-700 mb-2">How to use GameLab</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Describe the game you want to create in detail</li>
              <li>The AI will help design the game structure and code</li>
              <li>Switch to Game Preview to test your game</li>
              <li>Save your project to continue working on it later</li>
              <li>Download the code when you're ready to deploy</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}