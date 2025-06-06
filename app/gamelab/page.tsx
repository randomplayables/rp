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
import { 
  BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT, 
  BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT,
  BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS
} from "./prompts";


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GameLabApiResponse {
  message: string;
  originalCode?: string;
  code?: string;
  language?: string;
  error?: string;
  limitReached?: boolean;
  remainingRequests?: number;
}

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
    language: string,
    coderSystemPrompt: string | null,
    reviewerSystemPrompt: string | null,
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
      language,
      coderSystemPrompt,
      reviewerSystemPrompt,
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
  const [originalCode, setOriginalCode] = useState<string>(""); 
  const [sandboxCode, setSandboxCode] = useState<string>("");   
  const [currentLanguage, setCurrentLanguage] = useState<string>("tsx");
  const [currentTab, setCurrentTab] = useState<'code' | 'sandbox'>('code');
  const [codeError, setCodeError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [language, setLanguage] = useState('tsx'); 

  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [currentCoderSystemPrompt, setCurrentCoderSystemPrompt] = useState<string | null>(null);
  const [currentReviewerSystemPrompt, setCurrentReviewerSystemPrompt] = useState<string | null>(null);
  const [baseCoderTemplateWithContext, setBaseCoderTemplateWithContext] = useState<string | null>(null);
  const [baseReviewerTemplateWithContext, setBaseReviewerTemplateWithContext] = useState<string | null>(null);
  const [isLoadingSystemPrompts, setIsLoadingSystemPrompts] = useState(true);
  const [useCodeReview, setUseCodeReview] = useState<boolean>(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { user, isSignedIn, isLoaded: isUserLoaded } = useUser();
  const [selectedCoderModel, setSelectedCoderModel] = useState<string>("");
  const [selectedReviewerModel, setSelectedReviewerModel] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<ModelDefinition[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  const suggestedPrompts = {
    tsx: [
      "Create a number guessing game as a React/TSX sketch",
      "I want a simple grid-based puzzle game in React/TSX for the sandbox",
      "Help me design a memory matching game (React/TSX sketch)",
      "Make a game about coin flipping statistics (React/TSX sketch)",
      "Build a very basic ecosystem simulation (React/TSX sketch)"
    ],
    javascript: [
        "Create a simple clicker game with Vanilla JS",
        "Make a Vanilla JS game where a circle avoids the mouse cursor",
        "Build a basic 'Whack-a-Mole' game using plain JavaScript and CSS",
        "Code a simple memory card game in Vanilla JS",
        "Generate a basic particle animation with Vanilla JS and HTML Canvas"
    ]
  };

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
    const githubConnected = searchParams.get('github_connected');
    const shouldRestoreState = localStorage.getItem('gamelab_restore_on_callback') === 'true';

    if (githubConnected === 'true' && shouldRestoreState) {
      const pendingCode = localStorage.getItem('gamelab_pending_code');
      const pendingLanguage = localStorage.getItem('gamelab_pending_language');
      const pendingMessagesString = localStorage.getItem('gamelab_pending_messages');

      if (pendingCode) {
          setOriginalCode(pendingCode);
          setSandboxCode(""); 
      }
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

  const { mutate, isPending } = useMutation<GameLabApiResponse, Error, {message: string, language: string, useCodeReview: boolean, selectedCoderModelId?: string, selectedReviewerModelId?: string}>({
    mutationFn: (vars) => sendChatMessageToApi(vars.message, messages, vars.language, currentCoderSystemPrompt, currentReviewerSystemPrompt, vars.useCodeReview, vars.selectedCoderModelId, vars.selectedReviewerModelId),
    onSuccess: (data: GameLabApiResponse) => {
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.message, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.originalCode || data.code) {
        setOriginalCode(data.originalCode || data.code || "");
        setSandboxCode(data.code || "");
        setCurrentLanguage(data.language || "tsx");
        setCurrentTab('code');
        setCodeError(null);
      } else if (data.error) {
        setCodeError(data.error);
        setOriginalCode("");
        setSandboxCode("");
      } else {
        setCodeError(null);
      }
    },
    onError: (error: Error) => {
      setMessages(prev => [...prev, {role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date()}]);
      setCodeError("Failed to communicate with the AI. Please try again.");
    }
  });

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(scrollToBottom, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isPending) return;
    const userMessage: ChatMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    mutate({ 
        message: inputMessage, 
        language: language,
        useCodeReview: useCodeReview, 
        selectedCoderModelId: selectedCoderModel || undefined, 
        selectedReviewerModelId: useCodeReview && selectedReviewerModel ? (selectedReviewerModel || undefined) : undefined 
    });
    setInputMessage("");
  };

  const handleResetCoderSystemPrompt = () => {
    if (language === 'javascript') {
      setCurrentCoderSystemPrompt(BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS);
    } else {
      setCurrentCoderSystemPrompt(baseCoderTemplateWithContext || BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT);
    }
  };
  const handleResetReviewerSystemPrompt = () => { if (baseReviewerTemplateWithContext) { setCurrentReviewerSystemPrompt(baseReviewerTemplateWithContext); } else { initializeSystemPrompts(); } };

  const extractGameTitle = (): string => {
    if (originalCode) {
      const titleMatch = originalCode.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
      const h1Match = originalCode.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) return h1Match[1].trim();
    }
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    if (lastUserMessage) {
        const match = lastUserMessage.content.match(/create a (.*) game/i);
        if (match && match[1]) return match[1].trim().split(' ').map(w => w[0].toUpperCase() + w.substring(1)).join(' ');
    }
    return `GameLab Sketch ${new Date().toLocaleTimeString()}`;
  };

  const extractGameDescription = (): string => {
    return `A game sketch created with RandomPlayables GameLab. Language: ${currentLanguage}.`;
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
                <p>Select a language below, then describe the game you want to create.</p>
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2">Try these:</p>
                  {suggestedPrompts[language as keyof typeof suggestedPrompts].map((prompt, idx) => (
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
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white overflow-auto">
             <div className="flex flex-col space-y-2">
              <textarea
                value={inputMessage} onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isPending && inputMessage.trim()) handleSubmit(e); } }}
                placeholder="Describe your game idea..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                disabled={isPending} rows={3}
              />
              <div className="mt-2">
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
              <div className="mt-2">
                <label htmlFor="modelSelectorCoderGameLab" className="block text-xs font-medium text-gray-600">{useCodeReview ? "Coder Model" : "AI Model"} (Optional)</label>
                <select id="modelSelectorCoderGameLab" value={selectedCoderModel} onChange={(e) => setSelectedCoderModel(e.target.value)} disabled={isLoadingModels || isPending}
                  className="mt-1 block w-full py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs"
                >
                  <option value="">-- Use Default --</option>
                  {isLoadingModels ? <option disabled>Loading models...</option> : availableModels.length === 0 ? <option disabled>No models available.</option> : availableModels.map(model => (<option key={model.id} value={model.id}>{model.name}</option>))}
                </select>
              </div>
              {useCodeReview && (
                <div className="mt-2">
                  <label htmlFor="modelSelectorReviewerGameLab" className="block text-xs font-medium text-gray-600">Reviewer Model (Optional)</label>
                  <select id="modelSelectorReviewerGameLab" value={selectedReviewerModel} onChange={(e) => setSelectedReviewerModel(e.target.value)} disabled={isLoadingModels || isPending}
                    className="mt-1 block w-full py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs"
                  >
                    <option value="">-- Use Default Peer --</option>
                    {isLoadingModels ? <option disabled>Loading models...</option> : availableModels.length === 0 ? <option disabled>No models available.</option> : availableModels.map(model => (<option key={model.id + "-reviewer"} value={model.id}>{model.name}</option>))}
                  </select>
                </div>
              )}
              <div className="flex items-center mt-1">
                <input type="checkbox" id="useCodeReviewGameLab" checked={useCodeReview} onChange={(e) => { setUseCodeReview(e.target.checked); setSelectedCoderModel(""); setSelectedReviewerModel("");}}
                  className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="useCodeReviewGameLab" className="ml-2 text-sm text-gray-700">Enable AI Code Review (experimental)</label>
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
                  {isLoadingSystemPrompts ? <div className="flex items-center text-xs text-gray-500"><Spinner className="w-3 h-3 mr-1" /> Loading...</div> : (<>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{useCodeReview ? "Coder System Prompt:" : "System Prompt:"}</label>
                        <textarea value={currentCoderSystemPrompt || ""} onChange={(e) => setCurrentCoderSystemPrompt(e.target.value)}
                          className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Coder system prompt..."
                        />
                        <div className="flex justify-end mt-1">
                            <button type="button" onClick={handleResetCoderSystemPrompt} disabled={isLoadingSystemPrompts}
                              className="text-xs px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >Reset Coder</button>
                        </div>
                    </div>
                    {useCodeReview && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Reviewer System Prompt:</label>
                            <textarea value={currentReviewerSystemPrompt || ""} onChange={(e) => setCurrentReviewerSystemPrompt(e.target.value)}
                              className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Reviewer system prompt..."
                            />
                            <div className="flex justify-end mt-1">
                                <button type="button" onClick={handleResetReviewerSystemPrompt} disabled={isLoadingSystemPrompts || !baseReviewerTemplateWithContext}
                                  className="text-xs px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
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

        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white flex flex-col h-[calc(100vh-4rem)] max-h-[800px]">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-emerald-700">Game Lab Workspace</h2>
            <div className="flex items-center space-x-2">
              {originalCode && (<SaveSketchButton code={originalCode} language={currentLanguage} />)}
              <GitHubUploadButton gameTitle={extractGameTitle()} gameCode={originalCode} gameDescription={extractGameDescription()} currentLanguage={currentLanguage} messages={messages}/>
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
              originalCode ? <CodeBlock code={originalCode} language={currentLanguage} /> : <div className="flex-1 p-4 bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Your game code will appear here.</p></div>
            ) : (
              <GameSandbox code={sandboxCode} language={currentLanguage} />
            )}
          </div>

          {codeError && <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 flex-shrink-0">{codeError}</div>}
        </div>
      </div>
    </div>
  );
}