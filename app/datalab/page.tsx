"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from 'd3';
import SaveVisualizationButton from './components/SaveVisualizationButton';

// Simple toast utility (can be replaced with a library like react-hot-toast)
const toast = {
  error: (message: string) => { console.error("Toast (Error):", message); alert(`Error: ${message}`); },
  success: (message: string) => { console.log("Toast (Success):", message); alert(`Success: ${message}`); }
};

interface DataTypeOption {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_DATA_TYPES_UI: DataTypeOption[] = [
  { id: "Game", name: "Game Data", description: "Core game activity (sessions, gameplay, game metadata)." },
  { id: "Survey", name: "Survey Data", description: "User-created surveys and their responses." },
  { id: "Stack", name: "Stack Data", description: "Questions and answers from the Stack section." },
  { id: "Contributions", name: "Contributions Data", description: "User contribution metrics for Random Payables." },
  { id: "Content", name: "User Content", description: "Saved instruments, sketches, and visualizations." },
  { id: "Sandbox", name: "Sandbox Data", description: "Data from GameLab's testing sandbox environment." },
];

// Base System Prompt Template for DataLab
const BASE_DATALAB_SYSTEM_PROMPT_TEMPLATE = `
You are an AI assistant specialized in creating D3.js visualizations for a citizen science gaming platform.
You have access to data from MongoDB and PostgreSQL based on the user's selection.

IMPORTANT: The data is ALREADY PROVIDED to you in the dataContext when you generate D3 code.
DO NOT generate D3 code that fetches data using d3.json() or any other external data fetching.
All data must be used from the \`dataContext\` variable which will be made available to your D3 code.

General Available Data Overview:
The user can select from these data categories: %%DATALAB_AVAILABLE_DATA_CATEGORIES%%
A general set of keys that *might* be available in the dataContext (depending on selection and query) includes: %%DATALAB_GENERAL_SCHEMA_OVERVIEW%%

Query-Specific Data Context:
For the current user query, the exact available data keys in the \`dataContext\` are: %%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%
Use these specific keys to access data. For example: \`dataContext.recentSessions\`, \`dataContext.userSurveys['someKey']\`.
%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%

When creating visualizations:
1. Generate pure D3.js code that can be executed in a browser.
2. The code should expect 'd3', 'container' (the HTML element for the chart), and 'dataContext' as parameters.
3. Use the container parameter as the target element for the visualization.
4. EMBED ALL DATA referenced FROM THE \`dataContext\` DIRECTLY IN THE CODE if needed, or use the \`dataContext\` variable directly.
5. Include proper scales, axes, and labels.
6. Use responsive design principles where possible.
7. Apply emerald colors (#10B981, #059669, #047857) to match the theme.
8. Handle edge cases like empty data gracefully (e.g., if \`dataContext.userSurveys\` is empty).

Example of how to structure your D3 code:
\`\`\`javascript
// Access data from the provided dataContext
const sessions = dataContext.recentSessions || [];

if (dataContext.sandboxFetchError) {
  d3.select(container).append("p").style("color", "orange").text("Note: Sandbox data could not be fetched: " + dataContext.sandboxFetchError);
}

if (!sessions || sessions.length === 0) {
  d3.select(container)
    .append("p")
    .style("text-align", "center")
    .text("No session data available for visualization based on your selection.");
  return;
}

const margin = {top: 20, right: 30, bottom: 40, left: 90};
// ... rest of your D3 code ...
\`\`\`
When a user asks for a plot or visualization:
1. Analyze what data is relevant from the \`dataContext\` (keys: %%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%) based on their query AND their selected data types.
2. Extract and transform data from \`dataContext\` as needed.
3. Create an appropriate D3.js visualization.
4. Ensure the D3 code correctly accesses data via the \`dataContext\` variable.
Return ONLY the JavaScript code for the D3.js visualization. Do not include explanations unless specifically asked.
`;

function sanitizeD3Code(code: string): string {
  const fixedCode = code.replace(/d3\.array\.(max|min|extent|sum)/g, 'd3.$1');
  const withSafetyChecks = `
  try {
    if (!container) { console.error("D3 Render: Container element not found"); return; }
    if (!d3) { console.error("D3 Render: D3 library not found"); d3.select(container).text("D3 library not available."); return; }
    if (typeof dataContext === 'undefined') { console.error("D3 Render: dataContext is not defined."); d3.select(container).text("Data context not available."); return; }
    ${fixedCode}
  } catch (error) {
    console.error("Error in D3 visualization:", error);
    const vizContainer = d3.select(container || document.createElement('div'));
    vizContainer.selectAll("*").remove();
    vizContainer.append("div").style("color", "red").style("padding", "20px").style("text-align", "center").text("Error rendering D3: " + error.message);
  }`;
  return withSafetyChecks;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  code?: string;
  dataContext?: any;
}

interface DataLabApiResponse {
  message: string;
  code?: string;
  dataContext?: any;
  error?: string;
  limitReached?: boolean;
  remainingRequests?: number;
}

// Function to fetch Type A context data for DataLab
async function fetchDatalabContextData() {
  const response = await fetch("/api/datalab/context-data");
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Failed to fetch datalab context-data:", errorData.details || errorData.error);
    throw new Error(errorData.error || 'Failed to fetch DataLab context data');
  }
  return response.json();
}

async function sendChatMessageToApi(
  message: string,
  chatHistory: ChatMessage[],
  editedSystemPromptWithPlaceholders: string | null, // This is the user-edited prompt
  selectedDataTypes: string[]
) {
  const response = await fetch("/api/datalab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message,
      chatHistory: chatHistory.map(m => ({role: m.role, content: m.content})),
      customSystemPrompt: editedSystemPromptWithPlaceholders, // Send the user-edited prompt
      selectedDataTypes
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

  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState<string | null>(null); // User-editable, initially populated
  const [baseTemplateWithContext, setBaseTemplateWithContext] = useState<string | null>(null); // For reset
  const [isLoadingSystemPrompt, setIsLoadingSystemPrompt] = useState(true);

  const [showDbAccessOptions, setShowDbAccessOptions] = useState(false);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([AVAILABLE_DATA_TYPES_UI[0].id]);

  const suggestedPrompts = [
    "Show me a bar chart of game sessions by date for the last 30 days",
    "Create a pie chart showing the distribution of games played",
    "Plot the average scores across different games (ensure Game data type is selected)",
    "Show me user contributions (ensure Contributions data type is selected)",
    "Visualize public sketches count over time (ensure Content data type is selected)"
  ];

  const initializeSystemPrompt = useCallback(async () => {
    setIsLoadingSystemPrompt(true);
    try {
      const contextData = await fetchDatalabContextData();
      let populatedPrompt = BASE_DATALAB_SYSTEM_PROMPT_TEMPLATE;
      
      populatedPrompt = populatedPrompt.replace(
        '%%DATALAB_AVAILABLE_DATA_CATEGORIES%%',
        JSON.stringify(contextData.availableDataCategories || ['Game', 'Survey', 'Stack', 'Contributions', 'Content', 'Sandbox'])
      );
      populatedPrompt = populatedPrompt.replace(
        '%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%',
        JSON.stringify(contextData.generalContextKeys || ['Not loaded'])
      );
      // Type B placeholders (like %%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%% and %%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%)
      // will be resolved by the backend in the chat API.
      // However, we can clear them or put a generic message for the user's view.
      populatedPrompt = populatedPrompt.replace(
        '%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%',
        '(This will be filled by the backend based on your query)'
      );
      populatedPrompt = populatedPrompt.replace(
        '%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%',
        contextData.sandboxFetchErrorNote || '' // Add sandbox error note if present from context API
      );

      setCurrentSystemPrompt(populatedPrompt);
      setBaseTemplateWithContext(populatedPrompt);
    } catch (err) {
      console.error("Error initializing DataLab system prompt:", err);
      const errorPrompt = BASE_DATALAB_SYSTEM_PROMPT_TEMPLATE
        .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', 'Error loading categories.')
        .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', 'Error loading schema overview.')
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', '(Dynamic data based on query)')
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', '');
      setCurrentSystemPrompt(errorPrompt);
      setBaseTemplateWithContext(errorPrompt);
    } finally {
      setIsLoadingSystemPrompt(false);
    }
  }, []);

  useEffect(() => {
    initializeSystemPrompt();
  }, [initializeSystemPrompt]);

  const { mutate, isPending } = useMutation<DataLabApiResponse, Error, { message: string; chatHistory: ChatMessage[]; editedSystemPrompt: string | null; selectedDataTypes: string[] }>({
    mutationFn: (vars) => sendChatMessageToApi(vars.message, vars.chatHistory, vars.editedSystemPrompt, vars.selectedDataTypes),
    onSuccess: (data: DataLabApiResponse) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        code: data.code,
        dataContext: data.dataContext 
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.code && data.dataContext) {
        setCurrentCode(data.code);
        setCurrentDataContext(data.dataContext); // Store the received dataContext
        renderD3Plot(data.code, data.dataContext); // Pass it to renderD3Plot
      } else if (data.code && !data.dataContext) {
        setCurrentCode(data.code);
        setCurrentDataContext(null);
        renderD3Plot(data.code, null);
      } else if (data.error) {
         setVisualizationError(data.error);
         toast.error(data.error);
      }
      if (data.limitReached) {
          toast.error(data.error || "Monthly API request limit reached.");
      }
    },
    onError: (error: Error) => {
      setMessages(prev => [...prev, {role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date()}]);
      setVisualizationError("Failed to generate visualization: " + error.message);
      toast.error("Failed to generate visualization: " + error.message);
    }
  });

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  const renderD3Plot = (code: string, dataCtx: any) => {
    if (!plotRef.current) {
      setVisualizationError("Plot container not found.");
      return;
    }
    d3.select(plotRef.current).selectAll("*").remove();
    setVisualizationError(null);

    try {
      const safeCode = sanitizeD3Code(code);
      // The D3 code expects 'dataContext' to be globally available or passed in.
      // Here, we make it available to the Function constructor.
      const plotFunction = new Function('d3', 'container', 'dataContext', safeCode);
      plotFunction(d3, plotRef.current, dataCtx); // Pass dataCtx here
    } catch (error) {
      const errorMessage = `Error rendering D3 plot: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setVisualizationError(errorMessage);
      try {
        d3.select(plotRef.current).append("div").style("color", "red").style("padding", "20px").style("text-align", "center").text(errorMessage);
      } catch (d3Error) { console.error("D3 Render (Error Display):", d3Error); }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isPending) return;
    if (selectedDataTypes.length === 0) {
      toast.error("Please select at least one data type.");
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    // Pass currentSystemPrompt (the user-edited one) to the mutation
    mutate({ message: inputMessage, chatHistory: messages, editedSystemPrompt: currentSystemPrompt, selectedDataTypes });
    setInputMessage("");
  };
  
  const handleDataTypeToggle = (dataTypeId: string) => {
    setSelectedDataTypes(prev => {
      const isSelected = prev.includes(dataTypeId);
      if (isSelected) {
        if (prev.length === 1) {
            toast.error("At least one data type must be selected.");
            return prev;
        }
        return prev.filter(id => id !== dataTypeId);
      } else {
        return [...prev, dataTypeId];
      }
    });
    // No automatic re-fetch of system prompt context here,
    // as the general context is meant to be broad.
    // If specific context is needed per data type selection for Type A,
    // then initializeSystemPrompt (or a variant) could be called.
  };

  const handleResetSystemPrompt = () => {
    if (baseTemplateWithContext) {
      setCurrentSystemPrompt(baseTemplateWithContext);
    } else {
      initializeSystemPrompt(); // Re-fetch if not available
    }
  };
  
  const downloadTranscript = () => { /* ... (keep existing implementation) ... */ };
  const downloadCode = () => { /* ... (keep existing implementation) ... */ };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Left Panel: Chat Interface */}
        <div className="w-full md:w-1/3 lg:w-1/3 flex flex-col h-[calc(100vh-4rem)] max-h-[800px] bg-gray-50">
          <div className="p-4 bg-emerald-500 text-white">
            <h1 className="text-2xl font-bold">AI Data Lab</h1>
            <p className="text-sm">Chat to create D3.js visualizations</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isPending && (
              <div className="text-gray-500 text-center mt-8">
                <p className="mb-2">Select data types under "DB Access Options" below, then ask me to visualize your data!</p>
                <p className="text-sm mt-2">Example: "Show me a bar chart of game sessions by date"</p>
                 <div className="mt-4">
                  <p className="text-xs font-semibold mb-2">Try these prompts:</p>
                  {suggestedPrompts.map((prompt, idx) => (
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
                  msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200'
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
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isPending && inputMessage.trim()) handleSubmit(e); }}}
                placeholder="Ask about your data..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                disabled={isPending}
                rows={3}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending || selectedDataTypes.length === 0}
                  title={selectedDataTypes.length === 0 ? "Select data types first" : "Send message"}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? <Spinner className="w-4 h-4 inline mr-1"/> : null}
                  {isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
            
            <div className="mt-3 border-t pt-3 space-y-1">
              <button type="button" onClick={() => setShowDbAccessOptions(!showDbAccessOptions)} className="text-xs text-gray-600 hover:text-emerald-700 font-medium">
                {showDbAccessOptions ? "▼ Hide DB Access Options" : "▶ Show DB Access Options"}
              </button>
              {showDbAccessOptions && (
                <div className="mt-1 p-3 border border-gray-200 rounded-md bg-gray-50 max-h-48 overflow-y-auto">
                  <h4 className="text-xs font-semibold mb-2 text-gray-700">Select Data Types to Access:</h4>
                  <div className="space-y-1">
                    {AVAILABLE_DATA_TYPES_UI.map(dataType => (
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

            <div className="mt-1 border-t pt-3 space-y-1">
              <button type="button" onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)} className="text-xs text-gray-600 hover:text-emerald-700 font-medium">
                {showSystemPromptEditor ? "▼ Hide System Prompt" : "▶ Show System Prompt"}
              </button>
              {showSystemPromptEditor && (
                <div className="mt-1">
                  {isLoadingSystemPrompt ? (
                     <div className="flex items-center text-xs text-gray-500">
                       <Spinner className="w-3 h-3 mr-1" /> Loading default prompt...
                     </div>
                  ) : (
                    <textarea
                      value={currentSystemPrompt || ""}
                      onChange={(e) => setCurrentSystemPrompt(e.target.value)}
                      className="w-full h-28 px-2 py-1 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="System prompt..."
                    />
                  )}
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleResetSystemPrompt}
                      disabled={isLoadingSystemPrompt || !baseTemplateWithContext}
                      className="text-xs px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
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
        <div className="w-full md:w-2/3 lg:w-2/3 p-6 bg-white flex flex-col h-[calc(100vh-4rem)] max-h-[800px]">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-emerald-700">Visualization</h2>
            <div className="space-x-2">
              <button onClick={() => setShowCode(!showCode)} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 transition-colors">
                {showCode ? 'Hide Details' : 'Show Details'}
              </button>
              {currentCode && <SaveVisualizationButton code={currentCode} />}
              <button onClick={downloadTranscript} className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
                Transcript
              </button>
              {currentCode && <button onClick={downloadCode} className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"> Code </button>}
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg flex-grow min-h-[300px] flex items-center justify-center relative shadow-inner">
            <div ref={plotRef} className="w-full h-full" />
            {!currentCode && !isPending && (
              <p className="text-gray-400 absolute inset-0 flex items-center justify-center text-center p-4">
                Your D3.js visualization will appear here.
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
                  <pre className="text-xs whitespace-pre-wrap"><code>{currentCode}</code></pre>
                </div>
              )}
              {currentDataContext && (
                <div className="bg-gray-800 text-gray-400 p-3 rounded-lg max-h-48 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-gray-200 mb-1">Data Context for Above Visualization:</h4>
                  <pre className="text-xs whitespace-pre-wrap"><code>{JSON.stringify(currentDataContext, null, 2)}</code></pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}