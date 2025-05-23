// "use client"

// import { Spinner } from "@/components/spinner";
// import { useMutation, useQuery } from "@tanstack/react-query";
// import { useState, useEffect, useRef } from "react";
// import { CodeBlock } from './components/CodeBlock';
// import GameSandbox from "./components/GameSandbox";
// import SaveSketchButton from './components/SaveSketchButton';
// import GitHubUploadButton from './components/GitHubUploadButton';

// interface ChatMessage {
//   role: 'user' | 'assistant';
//   content: string;
//   timestamp: Date;
// }

// interface GameLabResponse {
//   message: string;
//   code?: string;
//   language?: string;
//   error?: string;
// }

// async function sendChatMessage(message: string, chatHistory: ChatMessage[], customSystemPrompt: string | null) {
//   const response = await fetch("/api/gamelab/chat", {
//     method: "POST",
//     headers: {"Content-Type": "application/json"},
//     body: JSON.stringify({ 
//       message, 
//       chatHistory,
//       systemPrompt: customSystemPrompt // Add system prompt to request
//     })
//   });
  
//   return response.json();
// }

// export default function GameLabPage() {
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [inputMessage, setInputMessage] = useState("");
//   const [currentCode, setCurrentCode] = useState<string>("");
//   const [currentLanguage, setCurrentLanguage] = useState<string>("javascript");
//   const [currentTab, setCurrentTab] = useState<'code' | 'sandbox'>('code');
//   const [codeError, setCodeError] = useState<string | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   // New state variables for system prompt
//   const [showSystemPrompt, setShowSystemPrompt] = useState(false);
//   const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
//   const [initialSystemPrompt, setInitialSystemPrompt] = useState<string | null>(null);
  
//   // Fetch the default system prompt when component loads
//   useEffect(() => {
//     fetch("/api/gamelab/system-prompt")
//       .then(res => res.json())
//       .then(data => {
//         setSystemPrompt(data.systemPrompt);
//         setInitialSystemPrompt(data.systemPrompt);
//       })
//       .catch(err => console.error("Error fetching system prompt:", err));
//   }, []);

//   const { mutate, isPending } = useMutation({
//     mutationFn: (message: string) => sendChatMessage(message, messages, systemPrompt),
//     onSuccess: (data: GameLabResponse) => {
//       const assistantMessage: ChatMessage = {
//         role: 'assistant',
//         content: data.message,
//         timestamp: new Date()
//       };
//       setMessages(prev => [...prev, assistantMessage]);
      
//       if (data.code) {
//         console.log("🔍 GameLab Client: Received code of length:", data.code.length);
//         setCurrentCode(data.code);
//         setCurrentLanguage(data.language || "javascript");
//         // Automatically switch to code tab when we get new code
//         setCurrentTab('code');
//       } else {
//         console.error("🔍 GameLab Client: No code received in response", data);
//       }
      
//       if (data.error) {
//         setCodeError(data.error);
//       } else {
//         setCodeError(null);
//       }
//     },
//     onError: (error: Error) => {
//       console.error("Error in GameLab chat:", error);
//       setCodeError("Failed to communicate with the AI assistant. Please try again.");
//     }
//   });
  
//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };
  
//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);
  
//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!inputMessage.trim()) return;
    
//     const userMessage: ChatMessage = {
//       role: 'user',
//       content: inputMessage,
//       timestamp: new Date()
//     };
    
//     setMessages(prev => [...prev, userMessage]);
//     mutate(inputMessage);
//     setInputMessage("");
//   };
  
//   const fetchGameTemplates = async () => {
//     try {
//       const response = await fetch("/api/gamelab/suggestions");
//       const data = await response.json();
//       return data.suggestions || [];
//     } catch (error) {
//       console.error("Error fetching templates:", error);
//       return [
//         "Create a simple number guessing game",
//         "Help me build a word puzzle game",
//         "I want to make a memory matching game",
//         "Can you create a probability-based game like Gotham Loops?"
//       ];
//     }
//   };
  
//   const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
//     "Create a simple number guessing game",
//     "Help me build a word puzzle game",
//     "I want to make a memory matching game",
//     "Can you create a probability-based game like Gotham Loops?"
//   ]);
  
//   useEffect(() => {
//     fetchGameTemplates().then(setSuggestedPrompts);
//   }, []);
  
//   const downloadCode = () => {
//     if (!currentCode) return;
    
//     // Determine appropriate extension based on language and code content
//     let extension = "txt";
//     let fileContent = currentCode;
    
//     if (currentLanguage === "javascript" || currentLanguage === "js") {
//       extension = "js";
//     } else if (currentLanguage === "typescript" || currentLanguage === "ts") {
//       extension = "ts";
//     } else if (currentLanguage === "jsx") {
//       extension = "jsx";
//     } else if (currentLanguage === "tsx") {
//       extension = "tsx";
//     } else if (currentLanguage === "html" || currentCode.includes("<!DOCTYPE html>") || currentCode.includes("<html")) {
//       extension = "html";
//     }
    
//     // If it looks like we have multiple files described in the chat, bundle them properly
//     const fileMatches = currentCode.match(/```\w+\s+\/\/\s+([a-zA-Z0-9_.-]+)\s+([\s\S]*?)```/g);
//     if (fileMatches && fileMatches.length > 1) {
//       // Create a zip file with all the files
//       // For simplicity, we'll just create a text file with clear file separators
//       fileContent = "/* GAMELAB MULTI-FILE EXPORT */\n\n" + currentCode;
//       extension = "txt";
//     }
    
//     // For HTML, check if we need to include separate JS and CSS files
//     if (extension === "html") {
//       // Extract CSS
//       const cssMatch = currentCode.match(/<style>([\s\S]*?)<\/style>/);
//       const cssContent = cssMatch ? cssMatch[1].trim() : "";
      
//       // Extract JavaScript
//       const jsMatch = currentCode.match(/<script>([\s\S]*?)<\/script>/);
//       const jsContent = jsMatch ? jsMatch[1].trim() : "";
      
//       // If we have substantial CSS or JS, offer them as separate files
//       if (cssContent.length > 100 || jsContent.length > 100) {
//         // Create a zip-like text bundle for clarity
//         fileContent = "/* GAMELAB HTML PROJECT */\n\n" +
//           "/* index.html */\n" + currentCode + "\n\n" +
//           (cssContent ? "/* styles.css */\n" + cssContent + "\n\n" : "") +
//           (jsContent ? "/* game.js */\n" + jsContent : "");
//         extension = "txt";
//       }
//     }
    
//     const blob = new Blob([fileContent], { type: 'text/plain' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `game-code-${new Date().toISOString()}.${extension}`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
    
//     console.log(`Downloaded code as ${extension} file, length: ${fileContent.length}`);
//   };
  
//   const downloadTranscript = () => {
//     const transcript = messages.map(msg => 
//       `${msg.role.toUpperCase()} [${msg.timestamp.toLocaleTimeString()}]: ${msg.content}`
//     ).join('\n\n');
    
//     const blob = new Blob([transcript], { type: 'text/plain' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `gamelab-transcript-${new Date().toISOString()}.txt`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
//   };
  
//   const clearChat = () => {
//     if (window.confirm("Are you sure you want to clear the chat? This will delete all messages and code.")) {
//       setMessages([]);
//       setCurrentCode("");
//       setCurrentLanguage("javascript");
//       setCodeError(null);
//     }
//   };
  
//   return (
//     <div className="min-h-screen flex items-center justify-center p-4">
//       <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
//         {/* Left Panel: Chat Interface */}
//         <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[700px] bg-gray-50">
//           <div className="p-4 bg-emerald-500 text-white">
//             <h1 className="text-2xl font-bold">AI Game Lab</h1>
//             <p className="text-sm">Chat to create games for RandomPlayables</p>
//           </div>
          
//           {/* Chat Messages */}
//           <div className="flex-1 overflow-y-auto p-4 space-y-4">
//             {messages.length === 0 && (
//               <div className="text-gray-500 text-center mt-8">
//                 <p>Welcome to GameLab! Describe the game you want to create.</p>
//                 <p className="text-sm mt-2">I'll help you turn your idea into a playable game.</p>
//                 <div className="mt-4">
//                   <p className="text-xs font-semibold mb-2">Try these:</p>
//                   {suggestedPrompts.map((prompt, idx) => (
//                     <button
//                       key={idx}
//                       onClick={() => setInputMessage(prompt)}
//                       className="block w-full text-left text-xs bg-white p-2 mb-1 rounded border hover:bg-gray-100"
//                     >
//                       {prompt}
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             )}
//             {messages.map((msg, idx) => (
//               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
//                 <div className={`max-w-[80%] p-3 rounded-lg ${
//                   msg.role === 'user' 
//                     ? 'bg-emerald-500 text-white' 
//                     : 'bg-white border border-gray-200'
//                 }`}>
//                   <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
//                   <p className="text-xs mt-1 opacity-70">
//                     {msg.timestamp.toLocaleTimeString()}
//                   </p>
//                 </div>
//               </div>
//             ))}
//             {isPending && (
//               <div className="flex justify-start">
//                 <div className="bg-white border border-gray-200 p-3 rounded-lg">
//                   <Spinner />
//                 </div>
//               </div>
//             )}
//             <div ref={messagesEndRef} />
//           </div>
          
//           {/* Input Form with System Prompt Toggle */}
//             <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
//               <div className="flex flex-col space-y-2">
//                 <textarea
//                   value={inputMessage}
//                   onChange={(e) => setInputMessage(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault();
//                       if (!isPending && inputMessage.trim()) handleSubmit(e);
//                     }
//                   }}
//                   placeholder="Describe your game idea..."
//                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
//                   disabled={isPending}
//                 />
//                 <div className="flex justify-end">
//                   <button
//                     type="submit"
//                     disabled={isPending}
//                     className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
//                   >
//                     Send
//                   </button>
//                 </div>
//               </div>
            
//             {/* System Prompt Editor */}
//             <div className="mt-2">
//               <button
//                 onClick={() => setShowSystemPrompt(!showSystemPrompt)}
//                 className="text-xs text-gray-500 hover:text-emerald-600"
//               >
//                 {showSystemPrompt ? "Hide System Prompt" : "Show System Prompt"}
//               </button>
              
//               {showSystemPrompt && systemPrompt !== null && (
//                 <div className="mt-2">
//                   <textarea
//                     value={systemPrompt}
//                     onChange={(e) => setSystemPrompt(e.target.value)}
//                     className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
//                     placeholder="System prompt is loading..."
//                   />
//                   <div className="flex justify-end mt-1 space-x-2">
//                     <button
//                       type="button"
//                       onClick={() => setSystemPrompt(initialSystemPrompt)}
//                       className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
//                     >
//                       Reset to Default
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </form>
//         </div>
        
//         {/* Right Panel: Code and Preview */}
//         <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
//           <div className="flex justify-between items-center mb-4">
//             <h2 className="text-2xl font-bold text-emerald-700">Game Lab</h2>
//             <div className="space-x-2">
//               <button
//                 onClick={clearChat}
//                 className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
//               >
//                 Clear Chat
//               </button>
//               {/* Add the save button */}
//               {currentCode && (
//                 <SaveSketchButton 
//                   code={currentCode} 
//                   language={currentLanguage} 
//                 />
//               )}
//               <button
//                 onClick={downloadTranscript}
//                 className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
//               >
//                 Download Transcript
//               </button>
//               {currentCode && (
//                 <button
//                   onClick={downloadCode}
//                   className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
//                 >
//                   Download Code
//                 </button>
//               )}
//               {currentCode && (
//                 <GitHubUploadButton 
//                   gameTitle={extractGameTitle()} // You'll need to implement this
//                   gameCode={currentCode}
//                   gameDescription="Created with RandomPlayables GameLab"
//                 />
//               )}
//             </div>
//           </div>
          
//           {/* Tabs */}
//           <div className="mb-4 border-b border-gray-200">
//             <ul className="flex flex-wrap -mb-px">
//               <li className="mr-2">
//                 <button
//                   className={`inline-block p-4 ${
//                     currentTab === 'code'
//                       ? 'text-emerald-600 border-b-2 border-emerald-600'
//                       : 'text-gray-500 hover:text-gray-700'
//                   }`}
//                   onClick={() => setCurrentTab('code')}
//                 >
//                   Code Editor
//                 </button>
//               </li>
//               <li className="mr-2">
//                 <button
//                   className={`inline-block p-4 ${
//                     currentTab === 'sandbox'
//                       ? 'text-emerald-600 border-b-2 border-emerald-600'
//                       : 'text-gray-500 hover:text-gray-700'
//                   }`}
//                   onClick={() => setCurrentTab('sandbox')}
//                 >
//                   Game Preview
//                 </button>
//               </li>
//             </ul>
//           </div>
          
//           {/* Tab Content */}
//           <div className="mb-6 rounded-lg min-h-[400px] flex flex-col">
//             {currentTab === 'code' ? (
//               <>
//                 {/* Code Display */}
//                 {currentCode ? (
//                   <CodeBlock code={currentCode} language={currentLanguage} />
//                 ) : (
//                   <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center">
//                     <p className="text-gray-500">Your game code will appear here</p>
//                   </div>
//                 )}
//               </>
//             ) : (
//               // Game Sandbox Tab
//               <GameSandbox 
//                 code={currentCode} 
//                 language={currentLanguage} 
//               />
//             )}
//           </div>
          
//           {/* Error display */}
//           {codeError && (
//             <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
//               {codeError}
//             </div>
//           )}
          
//           {/* Instructions */}
//           <div className="mt-6 bg-gray-50 p-4 rounded-lg">
//             <h3 className="font-bold text-emerald-700 mb-2">How to use GameLab</h3>
//             <ol className="list-decimal list-inside space-y-2 text-sm">
//               <li>Describe the game you want to create in detail</li>
//               <li>The AI will help design the game structure and code</li>
//               <li>Switch to Game Preview to test your game</li>
//               <li>Download the code when you're ready to deploy</li>
//             </ol>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// Update to app/gamelab/page.tsx

"use client"

import { Spinner } from "@/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { CodeBlock } from './components/CodeBlock';
import GameSandbox from "./components/GameSandbox";
import SaveSketchButton from './components/SaveSketchButton';
import GitHubUploadButton from './components/GitHubUploadButton'; // Add this import

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

async function sendChatMessage(message: string, chatHistory: ChatMessage[], customSystemPrompt: string | null) {
  const response = await fetch("/api/gamelab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ 
      message, 
      chatHistory,
      systemPrompt: customSystemPrompt
    })
  });
  
  return response.json();
}

export default function GameLabPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [currentLanguage, setCurrentLanguage] = useState<string>("javascript");
  const [currentTab, setCurrentTab] = useState<'code' | 'sandbox'>('code');
  const [codeError, setCodeError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New state variables for system prompt
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [initialSystemPrompt, setInitialSystemPrompt] = useState<string | null>(null);
  
  // Fetch the default system prompt when component loads
  useEffect(() => {
    fetch("/api/gamelab/system-prompt")
      .then(res => res.json())
      .then(data => {
        setSystemPrompt(data.systemPrompt);
        setInitialSystemPrompt(data.systemPrompt);
      })
      .catch(err => console.error("Error fetching system prompt:", err));
  }, []);

  // ========== ADD THIS FUNCTION ==========
  /**
   * Extracts a game title from various sources with fallback logic
   * Priority: HTML title tag > AI message context > user's last input > default
   */
  const extractGameTitle = (): string => {
    // 1. Try to extract from HTML title tag in the code
    if (currentCode) {
      const titleMatch = currentCode.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1] && titleMatch[1].trim() !== '') {
        let title = titleMatch[1].trim();
        // Clean up common generic titles
        if (!['Game', 'RandomPlayables Game', 'Untitled', 'Document'].includes(title)) {
          return title;
        }
      }
    }

    // 2. Try to extract from the most recent AI assistant message
    const lastAssistantMessage = messages
      .filter(msg => msg.role === 'assistant')
      .pop();
    
    if (lastAssistantMessage) {
      const content = lastAssistantMessage.content.toLowerCase();
      
      // Look for common patterns in AI responses
      const gamePatterns = [
        /(?:created?|built?|made)\s+(?:a\s+)?([^.!?]+?)\s+game/i,
        /(?:this\s+is\s+)?(?:a\s+)?([^.!?]+?)\s+game/i,
        /game\s+called\s+([^.!?]+)/i,
        /titled\s+([^.!?]+)/i,
        /creating\s+(?:a\s+)?([^.!?]+?)\s+game/i
      ];
      
      for (const pattern of gamePatterns) {
        const match = lastAssistantMessage.content.match(pattern);
        if (match && match[1]) {
          let title = match[1].trim();
          // Clean up the title
          title = title.replace(/^["']|["']$/g, ''); // Remove quotes
          title = title.replace(/\s+/g, ' '); // Normalize whitespace
          
          // Capitalize first letter of each word
          title = title.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          
          if (title.length > 3 && title.length < 50) {
            return title;
          }
        }
      }
    }

    // 3. Try to extract from user's most recent input
    const lastUserMessage = messages
      .filter(msg => msg.role === 'user')
      .pop();
    
    if (lastUserMessage) {
      const content = lastUserMessage.content;
      
      // Look for game-related keywords in user input
      const userPatterns = [
        /create\s+(?:a\s+)?([^.!?]+?)\s+game/i,
        /build\s+(?:a\s+)?([^.!?]+?)\s+game/i,
        /make\s+(?:a\s+)?([^.!?]+?)\s+game/i,
        /(?:a\s+)?([^.!?]+?)\s+game/i
      ];
      
      for (const pattern of userPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          let title = match[1].trim();
          title = title.replace(/^["']|["']$/g, '');
          title = title.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          
          if (title.length > 3 && title.length < 50) {
            return title;
          }
        }
      }
    }

    // 4. Try to detect game type from code patterns
    if (currentCode) {
      const codePatterns = [
        { pattern: /guessing|guess/i, title: 'Number Guessing Game' },
        { pattern: /memory|match/i, title: 'Memory Game' },
        { pattern: /puzzle|solve/i, title: 'Puzzle Game' },
        { pattern: /click|button/i, title: 'Click Game' },
        { pattern: /snake/i, title: 'Snake Game' },
        { pattern: /pong/i, title: 'Pong Game' },
        { pattern: /tetris/i, title: 'Tetris Game' },
        { pattern: /quiz/i, title: 'Quiz Game' },
        { pattern: /calculator/i, title: 'Calculator Game' },
        { pattern: /maze/i, title: 'Maze Game' },
        { pattern: /card/i, title: 'Card Game' },
        { pattern: /dice|roll/i, title: 'Dice Game' },
        { pattern: /tic.?tac.?toe/i, title: 'Tic Tac Toe' },
        { pattern: /rock.?paper.?scissors/i, title: 'Rock Paper Scissors' }
      ];
      
      for (const { pattern, title } of codePatterns) {
        if (pattern.test(currentCode)) {
          return title;
        }
      }
    }

    // 5. Generate title based on current timestamp for uniqueness
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    return `GameLab Creation ${dateString} ${timeString}`;
  };

  /**
   * Generates a description for the game based on the conversation context
   */
  const extractGameDescription = (): string => {
    const lastAssistantMessage = messages
      .filter(msg => msg.role === 'assistant')
      .pop();
    
    if (lastAssistantMessage) {
      const content = lastAssistantMessage.content;
      
      // Extract the first sentence that describes what the game does
      const sentences = content.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes('game') && 
            (sentence.toLowerCase().includes('this') || 
             sentence.toLowerCase().includes('creates') ||
             sentence.toLowerCase().includes('allows'))) {
          return sentence.trim() + '.';
        }
      }
    }
    
    return `A game created with RandomPlayables GameLab. Play directly in your browser!`;
  };
  // ========== END OF NEW FUNCTIONS ==========

  const { mutate, isPending } = useMutation({
    mutationFn: (message: string) => sendChatMessage(message, messages, systemPrompt),
    onSuccess: (data: GameLabResponse) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.code) {
        console.log("🔍 GameLab Client: Received code of length:", data.code.length);
        setCurrentCode(data.code);
        setCurrentLanguage(data.language || "javascript");
        setCurrentTab('code');
      } else {
        console.error("🔍 GameLab Client: No code received in response", data);
      }
      
      if (data.error) {
        setCodeError(data.error);
      } else {
        setCodeError(null);
      }
    },
    onError: (error: Error) => {
      console.error("Error in GameLab chat:", error);
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
    
    let extension = "txt";
    let fileContent = currentCode;
    
    if (currentLanguage === "javascript" || currentLanguage === "js") {
      extension = "js";
    } else if (currentLanguage === "typescript" || currentLanguage === "ts") {
      extension = "ts";
    } else if (currentLanguage === "jsx") {
      extension = "jsx";
    } else if (currentLanguage === "tsx") {
      extension = "tsx";
    } else if (currentLanguage === "html" || currentCode.includes("<!DOCTYPE html>") || currentCode.includes("<html")) {
      extension = "html";
    }
    
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
    
    console.log(`Downloaded code as ${extension} file, length: ${fileContent.length}`);
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
      setCurrentLanguage("javascript");
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
          
          {/* Input Form with System Prompt Toggle */}
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
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            
            {/* System Prompt Editor */}
            <div className="mt-2">
              <button
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                className="text-xs text-gray-500 hover:text-emerald-600"
              >
                {showSystemPrompt ? "Hide System Prompt" : "Show System Prompt"}
              </button>
              
              {showSystemPrompt && systemPrompt !== null && (
                <div className="mt-2">
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="System prompt is loading..."
                  />
                  <div className="flex justify-end mt-1 space-x-2">
                    <button
                      type="button"
                      onClick={() => setSystemPrompt(initialSystemPrompt)}
                      className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Reset to Default
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
        
        {/* Right Panel: Code and Preview */}
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-emerald-700">Game Lab</h2>
            <div className="space-x-2">
              <button
                onClick={clearChat}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear Chat
              </button>
              {/* ========== UPDATE THIS SECTION ========== */}
              {currentCode && (
                <>
                  <SaveSketchButton 
                    code={currentCode} 
                    language={currentLanguage} 
                  />
                  <GitHubUploadButton 
                    gameTitle={extractGameTitle()}
                    gameCode={currentCode}
                    gameDescription={extractGameDescription()}
                  />
                </>
              )}
              {/* ========== END UPDATE ========== */}
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
                {currentCode ? (
                  <CodeBlock code={currentCode} language={currentLanguage} />
                ) : (
                  <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center">
                    <p className="text-gray-500">Your game code will appear here</p>
                  </div>
                )}
              </>
            ) : (
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
          
          {/* Instructions */}
          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-emerald-700 mb-2">How to use GameLab</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Describe the game you want to create in detail</li>
              <li>The AI will help design the game structure and code</li>
              <li>Switch to Game Preview to test your game</li>
              <li>Save to profile or upload to GitHub when you're ready</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}