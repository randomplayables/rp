"use client"

import { Spinner } from "@/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
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
}

async function sendChatMessage(message: string, chatHistory: ChatMessage[]) {
  const response = await fetch("/api/collect/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ message, chatHistory })
  });
  
  return response.json();
}

async function createSurvey(surveyData: {
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

async function fetchSuggestions() {
  const response = await fetch("/api/collect/suggestions");
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
  
  const { data: suggestionData } = useQuery({
    queryKey: ['collectSuggestions'],
    queryFn: fetchSuggestions
  });
  
  const suggestedPrompts = suggestionData?.suggestions || [
    "I need a survey to collect feedback about my game",
    "Create a questionnaire about user gaming habits",
    "Design a survey with a game integration to study decision making",
    "I want to collect demographic data from players"
  ];
  
  const chatMutation = useMutation({
    mutationFn: (message: string) => sendChatMessage(message, messages),
    onSuccess: (data: CollectResponse) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  });
  
  const createSurveyMutation = useMutation({
    mutationFn: createSurvey,
    onSuccess: (data) => {
      // Show confirmation and sharable link
      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `✅ Survey created successfully!\n\nShare this link with participants: ${data.survey.shareableLink}\n\nClick "Save to Profile" to add this survey to your instruments collection.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Store the surveyId for the SaveInstrumentButton
        setSurveyData(prev => ({
          ...prev,
          savedId: data.survey.id
        }));
      }
    }
  });
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    chatMutation.mutate(inputMessage);
    setInputMessage("");
  };
  
  // Use useCallback for the question update and delete functions
  const handleQuestionUpdate = useCallback((id: string, data: any) => {
    const newQuestions = [...surveyData.questions];
    const index = newQuestions.findIndex(q => q.questionId === id);
    if (index !== -1) {
      newQuestions[index] = { ...newQuestions[index], ...data };
      setSurveyData(prev => ({ ...prev, questions: newQuestions }));
    }
  }, [surveyData.questions]);
  
  const handleQuestionDelete = useCallback((id: string) => {
    const newQuestions = surveyData.questions.filter(q => q.questionId !== id);
    setSurveyData(prev => ({ ...prev, questions: newQuestions }));
  }, [surveyData.questions]);
  
  const extractQuestions = () => {
    // This would be a more sophisticated function that parses
    // the AI's suggestions and extracts structured question data
    // For now, a simplified version:
    
    const lastAssistantMessage = messages
      .filter(m => m.role === 'assistant')
      .pop();
      
    if (!lastAssistantMessage) return;
    
    // Simple extraction for demo - would be more robust in production
    const questions: SurveyQuestion[] = [];
    const lines = lastAssistantMessage.content.split('\n');
    
    for (const line of lines) {
      if (line.match(/^\d+\.\s/)) {
        const text = line.replace(/^\d+\.\s/, '');
        questions.push({
          questionId: Math.random().toString(36).substring(2, 9),
          type: 'text', // Default
          text,
          required: true
        });
      }
    }
    
    if (questions.length > 0) {
      setSurveyData(prev => ({
        ...prev,
        questions
      }));
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
          
          {/* Chat Messages */}
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
          
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Describe your survey needs..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={chatMutation.isPending}
              />
              <button
                type="submit"
                disabled={chatMutation.isPending}
                className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                Send
              </button>
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
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                Extract Questions
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                {showPreview ? 'Edit Survey' : 'Preview Survey'}
              </button>
              <button
                onClick={() => createSurveyMutation.mutate(surveyData)}
                disabled={surveyData.questions.length === 0 || !surveyData.title}
                className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
              >
                Save & Share Survey
              </button>
              {surveyData.savedId && <SaveInstrumentButton surveyId={surveyData.savedId} />}
            </div>
          </div>
          
          {/* Survey Editor or Preview */}
          {showPreview ? (
            <SurveyPreview survey={surveyData} />
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              {/* Survey Title & Description */}
              <div className="mb-4">
                <input
                  type="text"
                  value={surveyData.title}
                  onChange={(e) => setSurveyData(prev => ({...prev, title: e.target.value}))}
                  placeholder="Survey Title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                />
                <textarea
                  value={surveyData.description}
                  onChange={(e) => setSurveyData(prev => ({...prev, description: e.target.value}))}
                  placeholder="Survey Description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
              </div>
              
              {/* Questions List */}
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
                
                {/* Add Question Button */}
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
                  className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
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