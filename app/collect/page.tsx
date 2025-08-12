"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import SurveyPreview from "./components/SurveyPreview";
import QuestionEditor from "./components/QuestionEditor";
import SaveInstrumentButton from './components/SaveInstrumentButton';
import { useUser } from "@clerk/nextjs";
import { ModelDefinition, getAvailableModelsForUser } from "@/lib/modelConfig";
import { IGame } from "@/types/Game";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SurveyQuestion {
  questionId: string;
  type: string;
  text: string;
  options?: string[];
  gameId?: string;
  required: boolean;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

interface CollectResponse {
  message: string;
  error?: string;
  limitReached?: boolean;
  remainingRequests?: number;
}

const BASE_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI assistant specialized in creating custom surveys for the RandomPlayables platform.
You help users design effective surveys, questionnaires, and data collection tools that can
optionally incorporate interactive games.

When a user asks to integrate a game, you MUST use the exact 'gameId' from the list below and format the question as a numbered list item, like this: "1. Game Integration: your-game-id-here".

Available games that can be integrated into surveys:
%%AVAILABLE_GAMES_LIST%%

When helping design surveys:
1. Ask clarifying questions about the user's research goals and target audience
2. Suggest appropriate question types (multiple choice, Likert scale, open-ended, etc.)
3. Help write clear, unbiased questions
4. Recommend game integration where appropriate for engagement or data collection
5. Advise on survey flow and organization

When designing a survey with game integration:
1. Explain how the game data will complement traditional survey questions
2. Discuss how to interpret combined qualitative and quantitative results
3. Suggest appropriate placement of games within the survey flow

Return your suggestions in a clear, structured format. If suggesting multiple questions,
number them and specify the question type for each. For game integrations, use the required format: "X. Game Integration: gameId".
`;

async function sendChatMessageToApi(
    message: string,
    chatHistory: ChatMessage[],
    coderSystemPrompt: string | null,
    selectedCoderModelId?: string
) {
  const response = await fetch("/api/collect/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message,
      chatHistory: chatHistory.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
      coderSystemPrompt, // Pass coder prompt
      selectedCoderModelId, 
    })
  });
  return response.json();
}

async function createSurveyInApi(surveyData: {
  title: string;
  description: string;
  questions: SurveyQuestion[];
}) {
  const response = await fetch("/api/collect/create", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(surveyData)
  });
  return response.json();
}

async function fetchCollectContextData() {
  const response = await fetch("/api/collect/context-data");
  if (!response.ok) {
    throw new Error('Failed to fetch collect context data');
  }
  return response.json();
}

export default function CollectPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [surveyData, setSurveyData] = useState<{
    title: string;
    description: string;
    questions: SurveyQuestion[];
    savedId?: string;
  }>({
    title: "",
    description: "",
    questions: [],
    savedId: undefined
  });
  const [showPreview, setShowPreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [currentCoderSystemPrompt, setCurrentCoderSystemPrompt] = useState<string | null>(null);
  
  const [baseCoderTemplateWithContext, setBaseCoderTemplateWithContext] = useState<string | null>(null);
  
  const [isLoadingSystemPrompts, setIsLoadingSystemPrompts] = useState(true);

  const { user, isSignedIn, isLoaded: isUserLoaded } = useUser();
  const [selectedCoderModel, setSelectedCoderModel] = useState<string>(""); 
  const [availableModels, setAvailableModels] = useState<ModelDefinition[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [availableGamesForParsing, setAvailableGamesForParsing] = useState<IGame[]>([]);

  const initializeSystemPrompts = useCallback(async () => {
    setIsLoadingSystemPrompts(true);
    try {
      const contextData = await fetchCollectContextData();
      const gamesListString = JSON.stringify(contextData.games || [], null, 2);
      
      setAvailableGamesForParsing(contextData.games || []);
      
      const initialCoderPrompt = BASE_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE.replace('%%AVAILABLE_GAMES_LIST%%', gamesListString);
      setCurrentCoderSystemPrompt(initialCoderPrompt);
      setBaseCoderTemplateWithContext(initialCoderPrompt);

    } catch (err) {
      console.error("Error fetching initial system prompt context:", err);
      const errorPromptText = 'Error: Could not load game list.';
      
      const errorCoderPrompt = BASE_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE.replace('%%AVAILABLE_GAMES_LIST%%', errorPromptText);
      setCurrentCoderSystemPrompt(errorCoderPrompt);
      setBaseCoderTemplateWithContext(errorCoderPrompt);

    } finally {
      setIsLoadingSystemPrompts(false);
    }
  }, []);

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
          console.error("Failed to fetch available models for CollectPage:", error);
          setAvailableModels(getAvailableModelsForUser(false));
        } finally {
          setIsLoadingModels(false);
        }
      }
    }
    fetchModelsForUser();
  }, [isUserLoaded, isSignedIn, user]);

  const suggestedPrompts = [
    "Create a survey about player demographics",
    "Design a questionnaire with Gotham Loops integration",
    "Make a feedback form for my game",
    "Build a survey to study player decision making",
    "Create a survey that includes multiple games",
    "Design a research tool for measuring player engagement",
    "Build a questionnaire about puzzle-solving strategies"
  ];

  const chatMutation = useMutation<CollectResponse, Error, { message: string, selectedCoderModelId?: string }>({
    mutationFn: (vars) => sendChatMessageToApi(vars.message, messages, currentCoderSystemPrompt, vars.selectedCoderModelId),
    onSuccess: (data: CollectResponse) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: Error) => {
      console.error("Chat mutation error:", error);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: Could not get a response. Details: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  });

  const createSurveyMutation = useMutation({
    mutationFn: createSurveyInApi,
    onSuccess: (data) => {
      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `✅ Survey created successfully!\n\nShare this link with participants: ${data.survey.shareableLink}\n\nClick "Save to Profile" to add this survey to your instruments collection.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setSurveyData(prev => ({
          ...prev,
          savedId: data.survey.id, 
        }));
      } else {
         const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `⚠️ Error creating survey: ${data.error || 'Unknown error'}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    },
    onError: (error: Error) => {
       const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `⚠️ Error creating survey: ${error.message}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate({ 
        message: inputMessage, 
        selectedCoderModelId: selectedCoderModel || undefined,
    });
    setInputMessage("");
  };

  const handleQuestionUpdate = useCallback((id: string, data: any) => {
    setSurveyData(prev => {
      const newQuestions = [...prev.questions];
      const index = newQuestions.findIndex(q => q.questionId === id);
      if (index !== -1) {
        newQuestions[index] = { ...newQuestions[index], ...data };
      }
      return { ...prev, questions: newQuestions };
    });
  }, []);

  const handleQuestionDelete = useCallback((id: string) => {
    setSurveyData(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.questionId !== id)
    }));
  }, []);

  const handleExtract = () => {
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
    if (!lastAssistantMessage) return;

    let content = lastAssistantMessage.content;
    let newTitle = surveyData.title;
    let newDescription = surveyData.description;

    // Extract Title
    const titleMatch = content.match(/^(Survey Title|Title):\s*(.*)/im);
    if (titleMatch && titleMatch[2]) {
        newTitle = titleMatch[2].trim();
        content = content.replace(titleMatch[0], '');
    }

    // Isolate the main "Questions" or "Questionnaire" section to prevent parsing footer notes
    const questionsSectionMatch = content.match(/^(Questions|Questionnaire)[\s\S]*/im);
    const questionsText = questionsSectionMatch ? questionsSectionMatch[0] : '';
    
    // Extract metadata from the text *before* the questions section
    const metadataText = questionsSectionMatch ? content.substring(0, questionsSectionMatch.index) : content;
    const metadataSections = ['Objective', 'Target Audience', 'Overview', 'Purpose', 'Rationale', 'Survey Flow'];
    let descriptionParts: string[] = [];
    metadataSections.forEach(section => {
        const regex = new RegExp(`^(${section}[\\s\\S]*?)(?=\\n\\n|$)`, "im");
        const match = metadataText.match(regex);
        if (match && match[1]) {
            descriptionParts.push(match[1].trim());
        }
    });
    if (descriptionParts.length > 0) {
        newDescription = descriptionParts.join('\n\n');
    }
    
    if (!questionsText) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: `I couldn't find a "Questions:" section in my last response to extract.`, timestamp: new Date() };
        setMessages(prev => [...prev, assistantMessage]);
        return;
    }

    const questionBlocks = questionsText.split(/\n(?=\s*\d+\.\s)/).filter(b => b.trim() && /^\s*\d+\.\s/.test(b));
    const extractedQuestions: SurveyQuestion[] = [];

    questionBlocks.forEach((block, index) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const firstLine = lines[0].replace(/^\d+\.\s*/, '').trim();
        let question: Partial<SurveyQuestion> = {
            questionId: `q_${Date.now()}_${index}`,
            type: 'text',
            text: firstLine,
            required: true,
        };
        
        const quotedTextMatch = block.match(/“([^”]*)”/);
        if (quotedTextMatch && quotedTextMatch[1]) {
            question.text = quotedTextMatch[1];
        }

        if (block.toLowerCase().includes('likert scale')) {
            question.type = 'scale';
            const scaleLabelsMatch = block.match(/\(\s*1\s*=\s*([^,;]+?)\s*[,;…]\s*5\s*=\s*([^\)]+?)\s*\)/i);
            if (scaleLabelsMatch) {
                question.scaleMinLabel = scaleLabelsMatch[1]?.trim();
                question.scaleMaxLabel = scaleLabelsMatch[2]?.trim();
            }
        } else if (block.toLowerCase().includes('multiple-choice') || block.toLowerCase().includes('multiple choice')) {
            question.type = 'multiple-choice';
            question.options = [];
            lines.forEach(line => {
                const optionMatch = line.match(/^\s*(?:[a-e][\.\)]|[•-])\s*(.*)/i);
                if (optionMatch && optionMatch[1] && !optionMatch[1].toLowerCase().startsWith('question type:')) {
                    question.options?.push(optionMatch[1].trim());
                }
            });
        } else if (block.toLowerCase().includes('open-ended')) {
            question.type = 'text';
        }

        if (firstLine.toLowerCase().startsWith('game integration:')) {
            question.type = 'game';
            question.text = 'Game Data Collection (automated)';
            const gameIdentifier = firstLine.substring(firstLine.indexOf(':') + 1).trim();
            let game = availableGamesForParsing.find(g => g?.gameId?.toLowerCase() === gameIdentifier.toLowerCase());
            if (!game) {
                game = availableGamesForParsing.find(g => g?.name?.toLowerCase() === gameIdentifier.toLowerCase());
            }
            question.gameId = game?.gameId || gameIdentifier;
        }
        
        extractedQuestions.push(question as SurveyQuestion);
    });

    if (extractedQuestions.length > 0) {
        setSurveyData(prev => ({
            ...prev,
            title: newTitle,
            description: newDescription,
            questions: [...prev.questions, ...extractedQuestions]
        }));
         const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `Extracted ${extractedQuestions.length} question(s). You can now edit them in the Survey Builder.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
    } else {
         const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `I couldn't find any numbered questions in my last response to extract.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
    }
  };
  
  const handleResetCoderSystemPrompt = () => {
    if (baseCoderTemplateWithContext) {
      setCurrentCoderSystemPrompt(baseCoderTemplateWithContext);
    } else {
      initializeSystemPrompts(); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[700px] bg-gray-50">
          <div className="p-4 bg-emerald-500 text-white">
            <h1 className="text-2xl font-bold">AI Survey Creator</h1>
            <p className="text-sm">Chat to create surveys with game integration</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-gray-500 text-center mt-8">
                <p>Describe what kind of survey you want to create!</p>
                <p className="text-sm mt-2">I'll help you design questions and integrate games.</p>
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2">Try these:</p>
                  {suggestedPrompts.map((prompt: string, idx: number) => (
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
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-lg">
                  <Spinner />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t bg-white overflow-auto">
            <div className="flex flex-col space-y-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!chatMutation.isPending && inputMessage.trim()) handleSubmit(e);
                  }
                }}
                placeholder="Describe your survey needs..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                disabled={chatMutation.isPending}
              />
              
              <div className="mt-2">
                <label htmlFor="modelSelectorCoderCollect" className="block text-xs font-medium text-gray-600">
                  AI Model (Optional)
                </label>
                <select
                  id="modelSelectorCoderCollect"
                  value={selectedCoderModel}
                  onChange={(e) => setSelectedCoderModel(e.target.value)}
                  disabled={isLoadingModels || chatMutation.isPending}
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

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={chatMutation.isPending}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {chatMutation.isPending ? <Spinner className="w-4 h-4 inline mr-1"/> : null}
                  Send
                </button>
              </div>
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)}
                className="text-xs text-gray-500 hover:text-emerald-600"
              >
                {showSystemPromptEditor ? "Hide System Prompts" : "Show System Prompts"}
              </button>

              {showSystemPromptEditor && (
                <div className="mt-2 space-y-3">
                  {isLoadingSystemPrompts ? (
                    <div className="flex items-center text-xs text-gray-500">
                      <Spinner className="w-3 h-3 mr-1" /> Loading default prompts...
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          System Prompt:
                        </label>
                        <textarea
                          value={currentCoderSystemPrompt || ""}
                          onChange={(e) => setCurrentCoderSystemPrompt(e.target.value)}
                          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Coder system prompt..."
                        />
                         <div className="flex justify-end mt-1">
                            <button
                            type="button"
                            onClick={handleResetCoderSystemPrompt}
                            disabled={isLoadingSystemPrompts || !baseCoderTemplateWithContext}
                            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                            >
                            Reset Prompt
                            </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-emerald-700">Survey Builder</h2>
                <div className="space-x-2">
                  <button
                    onClick={handleExtract}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                    title="Extract numbered questions from the last AI response"
                  >
                    Extract Questions
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  >
                    {showPreview ? 'Edit Survey' : 'Preview Survey'}
                  </button>
                  <button
                    onClick={() => {
                      if (!surveyData.title.trim()) {
                        alert("Survey title is required before saving.");
                        return;
                      }
                      createSurveyMutation.mutate(surveyData);
                    }}
                    disabled={surveyData.questions.length === 0 || !surveyData.title.trim() || createSurveyMutation.isPending}
                    className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 text-sm"
                  >
                    {createSurveyMutation.isPending ? 'Saving...' : 'Save & Share Survey'}
                  </button>
                  {surveyData.savedId && <SaveInstrumentButton surveyId={surveyData.savedId} />}
                </div>
            </div>
            {showPreview ? (
              <SurveyPreview survey={surveyData} />
            ) : (
                <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                    <div className="mb-4">
                        <input
                          type="text"
                          value={surveyData.title}
                          onChange={(e) => setSurveyData(prev => ({...prev, title: e.target.value}))}
                          placeholder="Survey Title (Required)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                        />
                        <textarea
                          value={surveyData.description}
                          onChange={(e) => setSurveyData(prev => ({...prev, description: e.target.value}))}
                          placeholder="Survey Description (Optional)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          rows={3}
                        />
                    </div>
                    <div className="space-y-4">
                        {surveyData.questions.map((question, idx) => (
                            <QuestionEditor
                              key={question.questionId}
                              questionId={question.questionId}
                              initialData={question}
                              onUpdate={handleQuestionUpdate}
                              onDelete={handleQuestionDelete}
                              index={idx}
                            />
                        ))}
                        <button
                          onClick={() => {
                            const newQuestion: SurveyQuestion = {
                              questionId: Math.random().toString(36).substring(2, 9),
                              type: 'text',
                              text: '',
                              options: [],
                              gameId: '',
                              required: true
                            };
                            setSurveyData(prev => ({
                              ...prev,
                              questions: [...prev.questions, newQuestion]
                            }));
                          }}
                          className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-100"
                        >
                          + Add Question
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}




// "use client"

// import { Spinner } from "@/components/spinner";
// import { useMutation } from "@tanstack/react-query";
// import { useState, useEffect, useRef, useCallback } from "react";
// import SurveyPreview from "./components/SurveyPreview";
// import QuestionEditor from "./components/QuestionEditor";
// import SaveInstrumentButton from './components/SaveInstrumentButton';
// import { useUser } from "@clerk/nextjs";
// import { ModelDefinition, getAvailableModelsForUser } from "@/lib/modelConfig";
// import { IGame } from "@/types/Game";

// interface ChatMessage {
//   role: 'user' | 'assistant';
//   content: string;
//   timestamp: Date;
// }

// interface SurveyQuestion {
//   questionId: string;
//   type: string;
//   text: string;
//   options?: string[];
//   gameId?: string;
//   required: boolean;
//   scaleMinLabel?: string;
//   scaleMaxLabel?: string;
// }

// interface CollectResponse {
//   message: string;
//   error?: string;
//   limitReached?: boolean;
//   remainingRequests?: number;
// }

// const BASE_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE = `
// You are an AI assistant specialized in creating custom surveys for the RandomPlayables platform.
// You help users design effective surveys, questionnaires, and data collection tools that can
// optionally incorporate interactive games.

// When a user asks to integrate a game, you MUST use the exact 'gameId' from the list below and format the question as a numbered list item, like this: "1. Game Integration: your-game-id-here".

// Available games that can be integrated into surveys:
// %%AVAILABLE_GAMES_LIST%%

// When helping design surveys:
// 1. Ask clarifying questions about the user's research goals and target audience
// 2. Suggest appropriate question types (multiple choice, Likert scale, open-ended, etc.)
// 3. Help write clear, unbiased questions
// 4. Recommend game integration where appropriate for engagement or data collection
// 5. Advise on survey flow and organization

// When designing a survey with game integration:
// 1. Explain how the game data will complement traditional survey questions
// 2. Discuss how to interpret combined qualitative and quantitative results
// 3. Suggest appropriate placement of games within the survey flow

// Return your suggestions in a clear, structured format. If suggesting multiple questions,
// number them and specify the question type for each. For game integrations, use the required format: "X. Game Integration: gameId".
// `;

// async function sendChatMessageToApi(
//     message: string,
//     chatHistory: ChatMessage[],
//     coderSystemPrompt: string | null,
//     selectedCoderModelId?: string
// ) {
//   const response = await fetch("/api/collect/chat", {
//     method: "POST",
//     headers: {"Content-Type": "application/json"},
//     body: JSON.stringify({
//       message,
//       chatHistory: chatHistory.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
//       coderSystemPrompt, // Pass coder prompt
//       selectedCoderModelId, 
//     })
//   });
//   return response.json();
// }

// async function createSurveyInApi(surveyData: {
//   title: string;
//   description: string;
//   questions: SurveyQuestion[];
// }) {
//   const response = await fetch("/api/collect/create", {
//     method: "POST",
//     headers: {"Content-Type": "application/json"},
//     body: JSON.stringify(surveyData)
//   });
//   return response.json();
// }

// async function fetchCollectContextData() {
//   const response = await fetch("/api/collect/context-data");
//   if (!response.ok) {
//     throw new Error('Failed to fetch collect context data');
//   }
//   return response.json();
// }

// export default function CollectPage() {
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [inputMessage, setInputMessage] = useState("");
//   const [surveyData, setSurveyData] = useState<{
//     title: string;
//     description: string;
//     questions: SurveyQuestion[];
//     savedId?: string;
//   }>({
//     title: "",
//     description: "",
//     questions: [],
//     savedId: undefined
//   });
//   const [showPreview, setShowPreview] = useState(false);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
//   const [currentCoderSystemPrompt, setCurrentCoderSystemPrompt] = useState<string | null>(null);
  
//   const [baseCoderTemplateWithContext, setBaseCoderTemplateWithContext] = useState<string | null>(null);
  
//   const [isLoadingSystemPrompts, setIsLoadingSystemPrompts] = useState(true);

//   const { user, isSignedIn, isLoaded: isUserLoaded } = useUser();
//   const [selectedCoderModel, setSelectedCoderModel] = useState<string>(""); 
//   const [availableModels, setAvailableModels] = useState<ModelDefinition[]>([]);
//   const [isLoadingModels, setIsLoadingModels] = useState(true);
//   const [availableGamesForParsing, setAvailableGamesForParsing] = useState<IGame[]>([]);

//   const initializeSystemPrompts = useCallback(async () => {
//     setIsLoadingSystemPrompts(true);
//     try {
//       const contextData = await fetchCollectContextData();
//       const gamesListString = JSON.stringify(contextData.games || [], null, 2);
      
//       setAvailableGamesForParsing(contextData.games || []);
      
//       const initialCoderPrompt = BASE_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE.replace('%%AVAILABLE_GAMES_LIST%%', gamesListString);
//       setCurrentCoderSystemPrompt(initialCoderPrompt);
//       setBaseCoderTemplateWithContext(initialCoderPrompt);

//     } catch (err) {
//       console.error("Error fetching initial system prompt context:", err);
//       const errorPromptText = 'Error: Could not load game list.';
      
//       const errorCoderPrompt = BASE_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE.replace('%%AVAILABLE_GAMES_LIST%%', errorPromptText);
//       setCurrentCoderSystemPrompt(errorCoderPrompt);
//       setBaseCoderTemplateWithContext(errorCoderPrompt);

//     } finally {
//       setIsLoadingSystemPrompts(false);
//     }
//   }, []);

//   useEffect(() => {
//     initializeSystemPrompts();
//   }, [initializeSystemPrompts]);

//   useEffect(() => {
//     async function fetchModelsForUser() {
//       if (isUserLoaded) {
//         setIsLoadingModels(true);
//         try {
//           let userIsSubscribed = false;
//           if (isSignedIn && user?.id) {
//             const profileResponse = await fetch(`/api/check-subscription?userId=${user.id}`);
//             if (profileResponse.ok) {
//               const profileData = await profileResponse.json();
//               userIsSubscribed = profileData?.subscriptionActive || false;
//             }
//           }
//           setAvailableModels(getAvailableModelsForUser(userIsSubscribed));
//         } catch (error) {
//           console.error("Failed to fetch available models for CollectPage:", error);
//           setAvailableModels(getAvailableModelsForUser(false));
//         } finally {
//           setIsLoadingModels(false);
//         }
//       }
//     }
//     fetchModelsForUser();
//   }, [isUserLoaded, isSignedIn, user]);

//   const suggestedPrompts = [
//     "Create a survey about player demographics",
//     "Design a questionnaire with Gotham Loops integration",
//     "Make a feedback form for my game",
//     "Build a survey to study player decision making",
//     "Create a survey that includes multiple games",
//     "Design a research tool for measuring player engagement",
//     "Build a questionnaire about puzzle-solving strategies"
//   ];

//   const chatMutation = useMutation<CollectResponse, Error, { message: string, selectedCoderModelId?: string }>({
//     mutationFn: (vars) => sendChatMessageToApi(vars.message, messages, currentCoderSystemPrompt, vars.selectedCoderModelId),
//     onSuccess: (data: CollectResponse) => {
//       const assistantMessage: ChatMessage = {
//         role: 'assistant',
//         content: data.message,
//         timestamp: new Date()
//       };
//       setMessages(prev => [...prev, assistantMessage]);
//     },
//     onError: (error: Error) => {
//       console.error("Chat mutation error:", error);
//       const assistantMessage: ChatMessage = {
//         role: 'assistant',
//         content: `Error: Could not get a response. Details: ${error.message}`,
//         timestamp: new Date()
//       };
//       setMessages(prev => [...prev, assistantMessage]);
//     }
//   });

//   const createSurveyMutation = useMutation({
//     mutationFn: createSurveyInApi,
//     onSuccess: (data) => {
//       if (data.success) {
//         const assistantMessage: ChatMessage = {
//           role: 'assistant',
//           content: `✅ Survey created successfully!\n\nShare this link with participants: ${data.survey.shareableLink}\n\nClick "Save to Profile" to add this survey to your instruments collection.`,
//           timestamp: new Date()
//         };
//         setMessages(prev => [...prev, assistantMessage]);
//         setSurveyData(prev => ({
//           ...prev,
//           savedId: data.survey.id, 
//         }));
//       } else {
//          const assistantMessage: ChatMessage = {
//           role: 'assistant',
//           content: `⚠️ Error creating survey: ${data.error || 'Unknown error'}`,
//           timestamp: new Date()
//         };
//         setMessages(prev => [...prev, assistantMessage]);
//       }
//     },
//     onError: (error: Error) => {
//        const assistantMessage: ChatMessage = {
//           role: 'assistant',
//           content: `⚠️ Error creating survey: ${error.message}`,
//           timestamp: new Date()
//         };
//         setMessages(prev => [...prev, assistantMessage]);
//     }
//   });

//   // NEW: Prevent auto-scroll on initial render; only scroll when new messages are appended.
//   const isFirstRender = useRef(true);
//   const prevMessageCount = useRef(0);
//   useEffect(() => {
//     const len = messages.length;

//     if (isFirstRender.current) {
//       isFirstRender.current = false;
//       prevMessageCount.current = len;
//       return;
//     }

//     if (len > prevMessageCount.current) {
//       messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//     }

//     prevMessageCount.current = len;
//   }, [messages]);

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!inputMessage.trim() || chatMutation.isPending) return;

//     const userMessage: ChatMessage = {
//       role: 'user',
//       content: inputMessage,
//       timestamp: new Date()
//     };

//     setMessages(prev => [...prev, userMessage]);
//     chatMutation.mutate({ 
//         message: inputMessage, 
//         selectedCoderModelId: selectedCoderModel || undefined,
//     });
//     setInputMessage("");
//   };

//   const handleQuestionUpdate = useCallback((id: string, data: any) => {
//     setSurveyData(prev => {
//       const newQuestions = [...prev.questions];
//       const index = newQuestions.findIndex(q => q.questionId === id);
//       if (index !== -1) {
//         newQuestions[index] = { ...newQuestions[index], ...data };
//       }
//       return { ...prev, questions: newQuestions };
//     });
//   }, []);

//   const handleQuestionDelete = useCallback((id: string) => {
//     setSurveyData(prev => ({
//       ...prev,
//       questions: prev.questions.filter(q => q.questionId !== id)
//     }));
//   }, []);

//   const handleExtract = () => {
//     const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
//     if (!lastAssistantMessage) return;

//     let content = lastAssistantMessage.content;
//     let newTitle = surveyData.title;
//     let newDescription = surveyData.description;

//     // Extract Title
//     const titleMatch = content.match(/^(Survey Title|Title):\s*(.*)/im);
//     if (titleMatch && titleMatch[2]) {
//         newTitle = titleMatch[2].trim();
//         content = content.replace(titleMatch[0], '');
//     }

//     // Isolate the main "Questions" or "Questionnaire" section to prevent parsing footer notes
//     const questionsSectionMatch = content.match(/^(Questions|Questionnaire)[\s\S]*/im);
//     const questionsText = questionsSectionMatch ? questionsSectionMatch[0] : '';
    
//     // Extract metadata from the text *before* the questions section
//     const metadataText = questionsSectionMatch ? content.substring(0, questionsSectionMatch.index) : content;
//     const metadataSections = ['Objective', 'Target Audience', 'Overview', 'Purpose', 'Rationale', 'Survey Flow'];
//     let descriptionParts: string[] = [];
//     metadataSections.forEach(section => {
//         const regex = new RegExp(`^(${section}[\\s\\S]*?)(?=\\n\\n|$)`, "im");
//         const match = metadataText.match(regex);
//         if (match && match[1]) {
//             descriptionParts.push(match[1].trim());
//         }
//     });
//     if (descriptionParts.length > 0) {
//         newDescription = descriptionParts.join('\n\n');
//     }
    
//     if (!questionsText) {
//         const assistantMessage: ChatMessage = { role: 'assistant', content: `I couldn't find a "Questions:" section in my last response to extract.`, timestamp: new Date() };
//         setMessages(prev => [...prev, assistantMessage]);
//         return;
//     }

//     const questionBlocks = questionsText.split(/\n(?=\s*\d+\.\s)/).filter(b => b.trim() && /^\s*\d+\.\s/.test(b));
//     const extractedQuestions: SurveyQuestion[] = [];

//     questionBlocks.forEach((block, index) => {
//         const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
//         if (lines.length === 0) return;

//         const firstLine = lines[0].replace(/^\d+\.\s*/, '').trim();
//         let question: Partial<SurveyQuestion> = {
//             questionId: `q_${Date.now()}_${index}`,
//             type: 'text',
//             text: firstLine,
//             required: true,
//         };
        
//         const quotedTextMatch = block.match(/“([^”]*)”/);
//         if (quotedTextMatch && quotedTextMatch[1]) {
//             question.text = quotedTextMatch[1];
//         }

//         if (block.toLowerCase().includes('likert scale')) {
//             question.type = 'scale';
//             const scaleLabelsMatch = block.match(/\(\s*1\s*=\s*([^,;]+?)\s*[,;…]\s*5\s*=\s*([^\)]+?)\s*\)/i);
//             if (scaleLabelsMatch) {
//                 question.scaleMinLabel = scaleLabelsMatch[1]?.trim();
//                 question.scaleMaxLabel = scaleLabelsMatch[2]?.trim();
//             }
//         } else if (block.toLowerCase().includes('multiple-choice') || block.toLowerCase().includes('multiple choice')) {
//             question.type = 'multiple-choice';
//             question.options = [];
//             lines.forEach(line => {
//                 const optionMatch = line.match(/^\s*(?:[a-e][\.\)]|[•-])\s*(.*)/i);
//                 if (optionMatch && optionMatch[1] && !optionMatch[1].toLowerCase().startsWith('question type:')) {
//                     question.options?.push(optionMatch[1].trim());
//                 }
//             });
//         } else if (block.toLowerCase().includes('open-ended')) {
//             question.type = 'text';
//         }

//         if (firstLine.toLowerCase().startsWith('game integration:')) {
//             question.type = 'game';
//             question.text = 'Game Data Collection (automated)';
//             const gameIdentifier = firstLine.substring(firstLine.indexOf(':') + 1).trim();
//             let game = availableGamesForParsing.find(g => g?.gameId?.toLowerCase() === gameIdentifier.toLowerCase());
//             if (!game) {
//                 game = availableGamesForParsing.find(g => g?.name?.toLowerCase() === gameIdentifier.toLowerCase());
//             }
//             question.gameId = game?.gameId || gameIdentifier;
//         }
        
//         extractedQuestions.push(question as SurveyQuestion);
//     });

//     if (extractedQuestions.length > 0) {
//         setSurveyData(prev => ({
//             ...prev,
//             title: newTitle,
//             description: newDescription,
//             questions: [...prev.questions, ...extractedQuestions]
//         }));
//          const assistantMessage: ChatMessage = {
//           role: 'assistant',
//           content: `Extracted ${extractedQuestions.length} question(s). You can now edit them in the Survey Builder.`,
//           timestamp: new Date()
//         };
//         setMessages(prev => [...prev, assistantMessage]);
//     } else {
//          const assistantMessage: ChatMessage = {
//           role: 'assistant',
//           content: `I couldn't find any numbered questions in my last response to extract.`,
//           timestamp: new Date()
//         };
//         setMessages(prev => [...prev, assistantMessage]);
//     }
//   };
  
//   const handleResetCoderSystemPrompt = () => {
//     if (baseCoderTemplateWithContext) {
//       setCurrentCoderSystemPrompt(baseCoderTemplateWithContext);
//     } else {
//       initializeSystemPrompts(); 
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center p-4">
//       <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
//         <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[700px] bg-gray-50">
//           <div className="p-4 bg-emerald-500 text-white">
//             <h1 className="text-2xl font-bold">AI Survey Creator</h1>
//             <p className="text-sm">Chat to create surveys with game integration</p>
//           </div>
//           <div className="flex-1 overflow-y-auto p-4 space-y-4">
//             {messages.length === 0 && (
//               <div className="text-gray-500 text-center mt-8">
//                 <p>Describe what kind of survey you want to create!</p>
//                 <p className="text-sm mt-2">I'll help you design questions and integrate games.</p>
//                 <div className="mt-4">
//                   <p className="text-xs font-semibold mb-2">Try these:</p>
//                   {suggestedPrompts.map((prompt: string, idx: number) => (
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
//             {chatMutation.isPending && (
//               <div className="flex justify-start">
//                 <div className="bg-white border border-gray-200 p-3 rounded-lg">
//                   <Spinner />
//                 </div>
//               </div>
//             )}
//             <div ref={messagesEndRef} />
//           </div>

//           <form onSubmit={handleSubmit} className="p-4 border-t bg-white overflow-auto">
//             <div className="flex flex-col space-y-2">
//               <textarea
//                 value={inputMessage}
//                 onChange={(e) => setInputMessage(e.target.value)}
//                 onKeyDown={(e) => {
//                   if (e.key === 'Enter' && !e.shiftKey) {
//                     e.preventDefault();
//                     if (!chatMutation.isPending && inputMessage.trim()) handleSubmit(e);
//                   }
//                 }}
//                 placeholder="Describe your survey needs..."
//                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
//                 disabled={chatMutation.isPending}
//               />
              
//               <div className="mt-2">
//                 <label htmlFor="modelSelectorCoderCollect" className="block text-xs font-medium text-gray-600">
//                   AI Model (Optional)
//                 </label>
//                 <select
//                   id="modelSelectorCoderCollect"
//                   value={selectedCoderModel}
//                   onChange={(e) => setSelectedCoderModel(e.target.value)}
//                   disabled={isLoadingModels || chatMutation.isPending}
//                   className="mt-1 block w-full py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs"
//                 >
//                   <option value="">-- Use Default --</option>
//                   {isLoadingModels ? (
//                     <option disabled>Loading models...</option>
//                   ) : availableModels.length === 0 ? (
//                      <option disabled>No models available.</option>
//                   ) : (
//                     availableModels.map(model => (
//                       <option key={model.id} value={model.id}>
//                         {model.name}
//                       </option>
//                     ))
//                   )}
//                 </select>
//               </div>

//               <div className="flex justify-end">
//                 <button
//                   type="submit"
//                   disabled={chatMutation.isPending}
//                   className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
//                 >
//                   {chatMutation.isPending ? <Spinner className="w-4 h-4 inline mr-1"/> : null}
//                   Send
//                 </button>
//               </div>
//             </div>

//             <div className="mt-2">
//               <button
//                 type="button"
//                 onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)}
//                 className="text-xs text-gray-500 hover:text-emerald-600"
//               >
//                 {showSystemPromptEditor ? "Hide System Prompts" : "Show System Prompts"}
//               </button>

//               {showSystemPromptEditor && (
//                 <div className="mt-2 space-y-3">
//                   {isLoadingSystemPrompts ? (
//                     <div className="flex items-center text-xs text-gray-500">
//                       <Spinner className="w-3 h-3 mr-1" /> Loading default prompts...
//                     </div>
//                   ) : (
//                     <>
//                       <div>
//                         <label className="block text-xs font-medium text-gray-700 mb-1">
//                           System Prompt:
//                         </label>
//                         <textarea
//                           value={currentCoderSystemPrompt || ""}
//                           onChange={(e) => setCurrentCoderSystemPrompt(e.target.value)}
//                           className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
//                           placeholder="Coder system prompt..."
//                         />
//                          <div className="flex justify-end mt-1">
//                             <button
//                             type="button"
//                             onClick={handleResetCoderSystemPrompt}
//                             disabled={isLoadingSystemPrompts || !baseCoderTemplateWithContext}
//                             className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
//                             >
//                             Reset Prompt
//                             </button>
//                         </div>
//                       </div>
//                     </>
//                   )}
//                 </div>
//               )}
//             </div>
//           </form>
//         </div>
//         <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
//              <div className="flex justify-between items-center mb-4">
//                 <h2 className="text-2xl font-bold text-emerald-700">Survey Builder</h2>
//                 <div className="space-x-2">
//                   <button
//                     onClick={handleExtract}
//                     className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
//                     title="Extract numbered questions from the last AI response"
//                   >
//                     Extract Questions
//                   </button>
//                   <button
//                     onClick={() => setShowPreview(!showPreview)}
//                     className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
//                   >
//                     {showPreview ? 'Edit Survey' : 'Preview Survey'}
//                   </button>
//                   <button
//                     onClick={() => {
//                       if (!surveyData.title.trim()) {
//                         alert("Survey title is required before saving.");
//                         return;
//                       }
//                       createSurveyMutation.mutate(surveyData);
//                     }}
//                     disabled={surveyData.questions.length === 0 || !surveyData.title.trim() || createSurveyMutation.isPending}
//                     className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 text-sm"
//                   >
//                     {createSurveyMutation.isPending ? 'Saving...' : 'Save & Share Survey'}
//                   </button>
//                   {surveyData.savedId && <SaveInstrumentButton surveyId={surveyData.savedId} />}
//                 </div>
//             </div>
//             {showPreview ? (
//               <SurveyPreview survey={surveyData} />
//             ) : (
//                 <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
//                     <div className="mb-4">
//                         <input
//                           type="text"
//                           value={surveyData.title}
//                           onChange={(e) => setSurveyData(prev => ({...prev, title: e.target.value}))}
//                           placeholder="Survey Title (Required)"
//                           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
//                         />
//                         <textarea
//                           value={surveyData.description}
//                           onChange={(e) => setSurveyData(prev => ({...prev, description: e.target.value}))}
//                           placeholder="Survey Description (Optional)"
//                           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
//                           rows={3}
//                         />
//                     </div>
//                     <div className="space-y-4">
//                         {surveyData.questions.map((question, idx) => (
//                             <QuestionEditor
//                               key={question.questionId}
//                               questionId={question.questionId}
//                               initialData={question}
//                               onUpdate={handleQuestionUpdate}
//                               onDelete={handleQuestionDelete}
//                               index={idx}
//                             />
//                         ))}
//                         <button
//                           onClick={() => {
//                             const newQuestion: SurveyQuestion = {
//                               questionId: Math.random().toString(36).substring(2, 9),
//                               type: 'text',
//                               text: '',
//                               options: [],
//                               gameId: '',
//                               required: true
//                             };
//                             setSurveyData(prev => ({
//                               ...prev,
//                               questions: [...prev.questions, newQuestion]
//                             }));
//                           }}
//                           className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-100"
//                         >
//                           + Add Question
//                         </button>
//                     </div>
//                 </div>
//             )}
//         </div>
//       </div>
//     </div>
//   );
// }