"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import SurveyPreview from "./components/SurveyPreview";
import QuestionEditor from "./components/QuestionEditor";
import SaveInstrumentButton from './components/SaveInstrumentButton';

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
}

interface CollectResponse {
  message: string;
  error?: string;
  limitReached?: boolean;
  remainingRequests?: number;
}

const BASE_SYSTEM_PROMPT_TEMPLATE = `
You are an AI assistant specialized in creating custom surveys for the RandomPlayables platform.
You help users design effective surveys, questionnaires, and data collection tools that can
optionally incorporate interactive games.

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
number them and specify the question type for each.
`;

// MODIFIED: Add useCodeReview parameter
async function sendChatMessageToApi(message: string, chatHistory: ChatMessage[], editedSystemPromptWithPlaceholders: string | null, useCodeReview: boolean) {
  const response = await fetch("/api/collect/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message,
      chatHistory: chatHistory.map(m => ({ role: m.role, content: m.content })),
      customSystemPrompt: editedSystemPromptWithPlaceholders,
      useCodeReview // NEW: Send the code review flag
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
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState<string | null>(null);
  const [baseTemplateWithContext, setBaseTemplateWithContext] = useState<string | null>(null);
  const [isLoadingSystemPrompt, setIsLoadingSystemPrompt] = useState(true);
  const [useCodeReview, setUseCodeReview] = useState<boolean>(false); // NEW: State for code review

  const initializeSystemPrompt = useCallback(async () => {
    setIsLoadingSystemPrompt(true);
    try {
      const contextData = await fetchCollectContextData();
      const gamesListString = JSON.stringify(contextData.games || [], null, 2);
      const initialPrompt = BASE_SYSTEM_PROMPT_TEMPLATE.replace('%%AVAILABLE_GAMES_LIST%%', gamesListString);
      setCurrentSystemPrompt(initialPrompt);
      setBaseTemplateWithContext(initialPrompt);
    } catch (err) {
      console.error("Error fetching initial system prompt context:", err);
      setCurrentSystemPrompt(BASE_SYSTEM_PROMPT_TEMPLATE.replace('%%AVAILABLE_GAMES_LIST%%', 'Error: Could not load game list.'));
      setBaseTemplateWithContext(BASE_SYSTEM_PROMPT_TEMPLATE.replace('%%AVAILABLE_GAMES_LIST%%', 'Error: Could not load game list.'));
    } finally {
      setIsLoadingSystemPrompt(false);
    }
  }, []);

  useEffect(() => {
    initializeSystemPrompt();
  }, [initializeSystemPrompt]);

  const suggestedPrompts = [
    "Create a survey about player demographics",
    "Design a questionnaire with Gotham Loops integration",
    "Make a feedback form for my game",
    "Build a survey to study player decision making",
    "Create a survey that includes multiple games",
    "Design a research tool for measuring player engagement",
    "Build a questionnaire about puzzle-solving strategies"
  ];

  // MODIFIED: Add useCodeReview to mutation variables type
  const chatMutation = useMutation<CollectResponse, Error, { message: string, useCodeReview: boolean }>({
    mutationFn: (vars) => sendChatMessageToApi(vars.message, messages, currentSystemPrompt, vars.useCodeReview), // MODIFIED: pass useCodeReview
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
    // MODIFIED: Pass useCodeReview state to the mutation
    chatMutation.mutate({ message: inputMessage, useCodeReview: useCodeReview });
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

  const extractQuestions = () => {
    const lastAssistantMessage = messages
      .filter(m => m.role === 'assistant')
      .pop();

    if (!lastAssistantMessage) return;

    const extractedQuestions: SurveyQuestion[] = [];
    const lines = lastAssistantMessage.content.split('\n');

    for (const line of lines) {
      if (line.match(/^\d+\.\s/)) {
        const text = line.replace(/^\d+\.\s/, '').trim();
        if (text) {
          extractedQuestions.push({
            questionId: Math.random().toString(36).substring(2, 9),
            type: 'text',
            text,
            required: true
          });
        }
      }
    }

    if (extractedQuestions.length > 0) {
      setSurveyData(prev => ({
        ...prev,
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
  
  const handleResetSystemPrompt = () => {
    if (baseTemplateWithContext) {
      setCurrentSystemPrompt(baseTemplateWithContext);
    } else {
      initializeSystemPrompt();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Left Panel: Chat Interface */}
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

          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
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
              {/* NEW: Code Review Checkbox */}
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  id="useCodeReviewCollect"
                  checked={useCodeReview}
                  onChange={(e) => setUseCodeReview(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="useCodeReviewCollect" className="ml-2 text-sm text-gray-700">
                  Enable AI Review (experimental)
                </label>
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
                {showSystemPromptEditor ? "Hide System Prompt" : "Show System Prompt"}
              </button>

              {showSystemPromptEditor && (
                <div className="mt-2">
                  {isLoadingSystemPrompt ? (
                    <div className="flex items-center text-xs text-gray-500">
                      <Spinner className="w-3 h-3 mr-1" /> Loading default prompt...
                    </div>
                  ) : (
                    <textarea
                      value={currentSystemPrompt || ""}
                      onChange={(e) => setCurrentSystemPrompt(e.target.value)}
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="System prompt..."
                    />
                  )}
                  <div className="flex justify-end mt-1 space-x-2">
                    <button
                      type="button"
                      onClick={handleResetSystemPrompt}
                      disabled={isLoadingSystemPrompt || !baseTemplateWithContext}
                      className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                      Reset to Default
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Right Panel: Survey Editor & Preview */}
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-emerald-700">Survey Builder</h2>
            <div className="space-x-2">
              <button
                onClick={extractQuestions}
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
                onClick={() => createSurveyMutation.mutate(surveyData)}
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
                    const newQuestion = {
                      questionId: Math.random().toString(36).substring(2, 9),
                      type: 'text',
                      text: '',
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