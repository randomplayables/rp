"use client"

import { Spinner } from "@/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query"; // useQuery will be partially removed
import { useState, useEffect, useRef } from "react";
import * as d3 from 'd3';
import SaveVisualizationButton from './components/SaveVisualizationButton';
// It's good practice to have a proper toast notification library
// For now, a simple placeholder or you can integrate one like 'react-hot-toast'
// import toast from 'react-hot-toast'; // Assuming you'd install and use this

// Simple toast utility if not using a library (replace with your preferred one)
const toast = {
  error: (message: string) => {
    console.error("Toast (Error):", message);
    // In a real app, you'd render this to the UI
    alert(`Error: ${message}`);
  },
  success: (message: string) => {
    console.log("Toast (Success):", message);
    alert(`Success: ${message}`);
  }
};

// Define the structure of the data types for the UI
interface DataTypeOption {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_DATA_TYPES: DataTypeOption[] = [
  { id: "Game", name: "Game Data", description: "Core game activity (sessions, gameplay, game metadata)." },
  { id: "Survey", name: "Survey Data", description: "User-created surveys and their responses." },
  { id: "Stack", name: "Stack Data", description: "Questions and answers from the Stack section." },
  { id: "Contributions", name: "Contributions Data", description: "User contribution metrics for Random Payables." },
  { id: "Content", name: "User Content", description: "Saved instruments, sketches, and visualizations." },
  { id: "Sandbox", name: "Sandbox Data", description: "Data from GameLab's testing sandbox environment." },
];

function sanitizeD3Code(code: string): string {
  // Replace common issues in D3 code that can cause errors
  const fixedCode = code.replace(/d3\.array\.(max|min|extent|sum)/g, 'd3.$1');

  // Add safety checks for data and container
  const withSafetyChecks = `
  // Safety wrapper for D3 code
  try {
    // Check if the container exists
    if (!container) {
      console.error("D3 Render: Container element not found");
      // Optionally, display an error in a predefined error div if 'container' itself is missing
      return;
    }
    // Check if d3 is available
    if (!d3) {
      console.error("D3 Render: D3 library not found");
      d3.select(container).text("D3 library not available."); // Display error in container
      return;
    }
    // Check if dataContext is defined (it should be by the time this runs)
    if (typeof dataContext === 'undefined') {
      console.error("D3 Render: dataContext is not defined. Make sure it's passed to the API and returned.");
      d3.select(container).text("Data context not available for visualization."); // Display error in container
      return;
    }

    ${fixedCode} // The actual D3 code from the AI

  } catch (error) {
    console.error("Error in D3 visualization:", error);
    // Attempt to select the container to display the error, even if other parts failed
    const vizContainer = d3.select(container || document.createElement('div')); // Fallback if container is null
    vizContainer.selectAll("*").remove(); // Clear previous content on error
    vizContainer.append("div")
      .style("color", "red")
      .style("padding", "20px")
      .style("text-align", "center")
      .text("Error rendering D3 visualization: " + error.message + ". Check console for details and dataContext structure.");
  }
  `;
  return withSafetyChecks;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  code?: string; // To store D3 code separately for assistant messages
  dataContext?: any; // To store dataContext with assistant messages that provide code
}

interface DataLabResponse {
  message: string;
  code?: string;
  dataContext?: any; // Expect dataContext from API
  error?: string;
  limitReached?: boolean;
  remainingRequests?: number;
}

// Pass selectedDataTypes to the API
async function sendChatMessage(
  message: string,
  chatHistory: ChatMessage[],
  customSystemPrompt: string | null,
  selectedDataTypes: string[] // New parameter
) {
  const response = await fetch("/api/datalab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message,
      // Send only essential parts of chat history to avoid large payloads
      chatHistory: chatHistory.map(m => ({role: m.role, content: m.content})),
      systemPrompt: customSystemPrompt,
      selectedDataTypes: selectedDataTypes // Pass selected data types
    })
  });
  return response.json();
}

export default function DataLabPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [currentDataContext, setCurrentDataContext] = useState<any>(null);
  const [showCode, setShowCode] = useState(false);
  const [visualizationError, setVisualizationError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [initialSystemPrompt, setInitialSystemPrompt] = useState<string | null>(null);

  const [showDbAccessOptions, setShowDbAccessOptions] = useState(false);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([AVAILABLE_DATA_TYPES[0].id]); // Default to "Game"

  // DEFINED STATICALLY: Define suggestedPrompts directly
  const suggestedPrompts = [
    "Show me a bar chart of game sessions by date for the last 30 days",
    "Create a pie chart showing the distribution of games played",
    "Plot the average scores across different games",
    "Show me a line chart of user activity over time",
    "Create a scatter plot of game duration vs score",
    "Visualize the number of unique players per game",
    "Show me a heatmap of player activity by hour of day",
    "Create a stacked bar chart of game sessions by difficulty level"
  ];

  useEffect(() => {
    fetch("/api/datalab/system-prompt") // System prompt logic kept for now
      .then(res => res.json())
      .then(data => {
        setSystemPrompt(data.systemPrompt);
        setInitialSystemPrompt(data.systemPrompt);
      })
      .catch(err => console.error("Error fetching system prompt:", err));
  }, []);

  const { mutate, isPending } = useMutation<DataLabResponse, Error, { message: string; chatHistory: ChatMessage[]; customSystemPrompt: string | null; selectedDataTypes: string[] }>({
    mutationFn: (vars) => sendChatMessage(vars.message, vars.chatHistory, vars.customSystemPrompt, vars.selectedDataTypes),
    onSuccess: (data: DataLabResponse) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        code: data.code,
        dataContext: data.dataContext
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.code && data.dataContext) {
        console.log("Received D3 code snippet:", data.code.substring(0, 200) + "...");
        console.log("Received dataContext:", data.dataContext);
        setCurrentCode(data.code);
        setCurrentDataContext(data.dataContext);
        renderD3Plot(data.code, data.dataContext);
      } else if (data.code && !data.dataContext) {
        console.warn("Received D3 code but no dataContext. Visualization might use embedded data or fail if it expects dataContext.");
        setCurrentCode(data.code);
        setCurrentDataContext(null);
        renderD3Plot(data.code, null); // Pass null for dataContext
      } else if (data.error) {
         setVisualizationError(data.error);
         toast.error(data.error);
      }

      if (data.limitReached) {
          toast.error(data.error || "Monthly API request limit reached. Please upgrade your plan for more requests.");
      }
    },
    onError: (error: Error) => {
      console.error("Error in DataLab API call:", error);
      const errMessage = "Failed to generate visualization: " + error.message + ". Please try again.";
      setVisualizationError(errMessage);
      toast.error(errMessage);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const renderD3Plot = (code: string, dataCtx: any) => {
    if (!plotRef.current) {
      console.error("D3 Render: Plot reference (plotRef.current) is not available.");
      setVisualizationError("Plot container not found. Cannot render D3 visualization.");
      return;
    }

    d3.select(plotRef.current).selectAll("*").remove(); // Clear previous plot
    setVisualizationError(null); // Clear previous errors

    try {
      const safeCode = sanitizeD3Code(code);
      console.log("D3 Render: Running sanitized D3 code. dataContext available:", !!dataCtx);
      
      const plotFunction = new Function('d3', 'container', 'dataContext', safeCode);
      plotFunction(d3, plotRef.current, dataCtx);
    } catch (error) {
      const errorMessage = `Error rendering D3 plot: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage, error);
      setVisualizationError(errorMessage);
      // Display error directly in the plot container if possible
      try {
        d3.select(plotRef.current)
            .append("div")
            .style("color", "red")
            .style("padding", "20px")
            .style("text-align", "center")
            .text(errorMessage);
      } catch (d3Error) {
        console.error("D3 Render: Could not even display error message in D3 container.", d3Error)
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isPending) return;
    if (selectedDataTypes.length === 0) {
      toast.error("Please select at least one data type from 'DB Access Options' before sending your message.");
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    mutate({ message: inputMessage, chatHistory: messages, customSystemPrompt: systemPrompt, selectedDataTypes });
    setInputMessage("");
  };
  
  const handleDataTypeToggle = (dataTypeId: string) => {
    setSelectedDataTypes(prev => {
      const isSelected = prev.includes(dataTypeId);
      if (isSelected) {
        // If unchecking, ensure at least one item remains selected.
        // Or, if "Game" is the only one and it's being unchecked, prevent it.
        if (prev.length === 1 && dataTypeId === AVAILABLE_DATA_TYPES[0].id) {
            toast.error("At least one data type must be selected. 'Game Data' is the default minimum.");
            return prev;
        }
        if (prev.length === 1 ) { // If only one is selected, don't allow unchecking
            toast.error("At least one data type must be selected.");
            return prev;
        }
        return prev.filter(id => id !== dataTypeId);
      } else {
        return [...prev, dataTypeId];
      }
    });
  };

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
        <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[calc(100vh-4rem)] max-h-[800px] bg-gray-50"> {/* Adjusted height */}
          <div className="p-4 bg-emerald-500 text-white">
            <h1 className="text-2xl font-bold">AI Data Lab</h1>
            <p className="text-sm">Chat to create D3.js visualizations from selected data</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isPending && (
              <div className="text-gray-500 text-center mt-8">
                <p className="mb-2">Select data types under "DB Access Options" below, then ask me to visualize your data!</p>
                <p className="text-sm mt-2">Example: "Show me a bar chart of game sessions by date"</p>
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2">Try these prompts:</p>
                  {suggestedPrompts.map((prompt: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setInputMessage(prompt)}
                      className="block w-full text-left text-xs bg-white p-2 mb-1 rounded border hover:bg-gray-100 transition-colors"
                    >
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
                    : 'bg-white border border-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && msg.code && msg.dataContext && (
                    <button
                      onClick={() => {
                        setCurrentCode(msg.code!);
                        setCurrentDataContext(msg.dataContext);
                        renderD3Plot(msg.code!, msg.dataContext);
                        setShowCode(true);
                        toast.success("Visualization reloaded from chat history.");
                      }}
                      className="mt-2 text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                    >
                      Reload Visualization
                    </button>
                  )}
                  <p className="text-xs mt-1 opacity-70">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                  <Spinner className="w-5 h-5" />
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
                    if (!isPending && inputMessage.trim()) handleSubmit(e);
                  }
                }}
                placeholder="Ask about your data..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                disabled={isPending}
                rows={3}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending || selectedDataTypes.length === 0}
                  title={selectedDataTypes.length === 0 ? "Select data types under 'DB Access Options' first" : "Send message"}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? <Spinner className="w-4 h-4 inline mr-1"/> : null}
                  {isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
            
            <div className="mt-3 border-t pt-3 space-y-1">
                 <button
                    type="button"
                    onClick={() => setShowDbAccessOptions(!showDbAccessOptions)}
                    className="text-xs text-gray-600 hover:text-emerald-700 font-medium"
                  >
                    {showDbAccessOptions ? "▼ Hide DB Access Options" : "▶ Show DB Access Options"}
                  </button>
                {showDbAccessOptions && (
                    <div className="mt-1 p-3 border border-gray-200 rounded-md bg-gray-50 max-h-48 overflow-y-auto">
                    <h4 className="text-xs font-semibold mb-2 text-gray-700">Select Data Types to Access:</h4>
                    <div className="space-y-1">
                        {AVAILABLE_DATA_TYPES.map(dataType => (
                        <label key={dataType.id} className="flex items-center text-xs text-gray-700 hover:bg-gray-100 p-1 rounded cursor-pointer">
                            <input
                            type="checkbox"
                            checked={selectedDataTypes.includes(dataType.id)}
                            onChange={() => handleDataTypeToggle(dataType.id)}
                            className="mr-2 h-3 w-3 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                            <span className="font-medium">{dataType.name}</span>
                            <span className="ml-1 text-gray-500 text-[11px]">- ({dataType.description})</span>
                        </label>
                        ))}
                    </div>
                    </div>
                )}
            </div>


            <div className="mt-1 border-t pt-3 space-y-1"> {/* System prompt UI kept for now */}
                <button
                    type="button"
                    onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                    className="text-xs text-gray-600 hover:text-emerald-700 font-medium"
                >
                    {showSystemPrompt ? "▼ Hide System Prompt" : "▶ Show System Prompt"}
                </button>
                {showSystemPrompt && systemPrompt !== null && (
                    <div className="mt-1">
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="System prompt is loading..."
                    />
                    <div className="flex justify-end mt-1">
                        <button
                        type="button"
                        onClick={() => setSystemPrompt(initialSystemPrompt)}
                        className="text-xs px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                        >
                        Reset
                        </button>
                    </div>
                    </div>
                )}
            </div>
          </form>
        </div>

        {/* Right Panel: Visualization and Code */}
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white flex flex-col h-[calc(100vh-4rem)] max-h-[800px]"> {/* Adjusted height */}
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-emerald-700">Visualization</h2>
            <div className="space-x-2">
              <button
                onClick={() => setShowCode(!showCode)}
                className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                {showCode ? 'Hide Code' : 'Show Code'}
              </button>
              {currentCode && (
                <SaveVisualizationButton
                  code={currentCode}
                  // previewImage={capturePreviewImage()} // You would need a function to capture the SVG/Canvas as an image
                />
              )}
              <button
                onClick={downloadTranscript}
                className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
              >
                Transcript
              </button>
              {currentCode && (
                <button
                  onClick={downloadCode}
                  className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
                >
                  Code
                </button>
              )}
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg flex-grow min-h-[300px] flex items-center justify-center relative shadow-inner">
            <div ref={plotRef} className="w-full h-full" />
            {!currentCode && !isPending && (
              <p className="text-gray-400 absolute inset-0 flex items-center justify-center text-center p-4">
                Your D3.js visualization will appear here once generated.
              </p>
            )}
            {isPending && messages.length > 0 && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 bg-opacity-75">
                    <Spinner className="h-10 w-10 mb-2"/>
                    <p className="text-gray-600 text-sm">Generating visualization...</p>
                </div>
            )}
          </div>

          {visualizationError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs flex-shrink-0">
              <strong>Error:</strong> {visualizationError}
            </div>
          )}

          {showCode && (
            <div className="flex flex-col space-y-2 overflow-auto flex-shrink-0">
              {currentCode && (
                <div className="bg-gray-900 text-gray-300 p-3 rounded-lg max-h-48 overflow-y-auto">
                   <h4 className="text-sm font-semibold text-gray-200 mb-1">Generated D3 Code:</h4>
                  <pre className="text-xs whitespace-pre-wrap">
                    <code>{currentCode}</code>
                  </pre>
                </div>
              )}
              {currentDataContext && (
                <div className="bg-gray-800 text-gray-400 p-3 rounded-lg max-h-48 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-gray-200 mb-1">Data Context for Above Visualization:</h4>
                  <pre className="text-xs whitespace-pre-wrap">
                    <code>{JSON.stringify(currentDataContext, null, 2)}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}