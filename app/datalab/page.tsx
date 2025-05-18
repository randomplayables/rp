"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import * as d3 from 'd3';
import SaveVisualizationButton from './components/SaveVisualizationButton';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DataLabResponse {
  message: string;
  code?: string;
  error?: string;
}

async function sendChatMessage(message: string, chatHistory: ChatMessage[], customSystemPrompt: string | null) {
  const response = await fetch("/api/datalab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ 
      message, 
      chatHistory,
      systemPrompt: customSystemPrompt // Add system prompt to request
    })
  });
  
  return response.json();
}

export default function DataLabPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [showCode, setShowCode] = useState(false);
  const [visualizationError, setVisualizationError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // New state variables for system prompt
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [initialSystemPrompt, setInitialSystemPrompt] = useState<string | null>(null);
  
  // Fetch the default system prompt when component loads
  useEffect(() => {
    fetch("/api/datalab/system-prompt")
      .then(res => res.json())
      .then(data => {
        setSystemPrompt(data.systemPrompt);
        setInitialSystemPrompt(data.systemPrompt);
      })
      .catch(err => console.error("Error fetching system prompt:", err));
  }, []);
  
  const { mutate, isPending } = useMutation({
    mutationFn: (message: string) => sendChatMessage(message, messages, systemPrompt),
    onSuccess: (data: DataLabResponse) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.code) {
        setCurrentCode(data.code);
        renderD3Plot(data.code);
      }
    },
    onError: (error: Error) => {
      console.error("Error:", error);
      setVisualizationError("Failed to generate visualization. Please try again.");
    }
  });
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const renderD3Plot = (code: string) => {
    if (!plotRef.current) return;
    
    // Clear previous plot and error
    d3.select(plotRef.current).selectAll("*").remove();
    setVisualizationError(null);
    
    try {
      // Create a function from the code and execute it
      const plotFunction = new Function('d3', 'container', code);
      plotFunction(d3, plotRef.current);
    } catch (error) {
      console.error("Error rendering D3 plot:", error);
      setVisualizationError(`Error rendering visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Display error in the plot container
      d3.select(plotRef.current)
        .append("div")
        .style("color", "red")
        .style("padding", "20px")
        .style("text-align", "center")
        .text(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
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
  
  // Add some suggested prompts for better UX
  const suggestedPrompts = [
    "Show me a bar chart of game sessions by date",
    "Create a pie chart of games played",
    "Plot average scores across different games",
    "Show me a line chart of user activity over time"
  ];
  
  const downloadTranscript = () => {
    const transcript = messages.map(msg => 
      `${msg.role.toUpperCase()} [${msg.timestamp.toLocaleTimeString()}]: ${msg.content}`
    ).join('\n\n');
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `datalab-transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const downloadCode = () => {
    if (!currentCode) return;
    
    const blob = new Blob([currentCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `d3-plot-${new Date().toISOString()}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Left Panel: Chat Interface */}
        <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[700px] bg-gray-50">
          <div className="p-4 bg-emerald-500 text-white">
            <h1 className="text-2xl font-bold">AI Data Lab</h1>
            <p className="text-sm">Chat to create D3.js visualizations</p>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-gray-500 text-center mt-8">
                <p>Start by asking me to visualize your data!</p>
                <p className="text-sm mt-2">Example: "Show me a bar chart of game sessions by date"</p>
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
                  <p className="text-sm">{msg.content}</p>
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
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about your data..."
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
        
        {/* Right Panel: Visualization and Code */}
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-emerald-700">Visualization</h2>
            <div className="space-x-2">
              <button
                onClick={() => setShowCode(!showCode)}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                {showCode ? 'Hide Code' : 'Show Code'}
              </button>

              {/* Add the save button */}
              {currentCode && (
                <SaveVisualizationButton 
                  code={currentCode} 
                  // Optionally capture a preview image
                  // previewImage={capturePreviewImage()}
                />
              )}
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
          
          {/* D3 Plot Container */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg min-h-[400px] flex items-center justify-center">
            <div ref={plotRef} className="w-full h-full" />
            {!currentCode && !isPending && (
              <p className="text-gray-500">Your visualization will appear here</p>
            )}
          </div>
          
          {/* Error display */}
          {visualizationError && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
              {visualizationError}
            </div>
          )}
          
          {/* Code Display */}
          {showCode && currentCode && (
            <div className="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
                <code>{currentCode}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}