"use client"

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from 'd3';
import SaveVisualizationButton from './components/SaveVisualizationButton';
import { useUser } from "@clerk/nextjs";
import { ModelDefinition, getAvailableModelsForUser } from "@/lib/modelConfig";

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
  { id: "Game.pointtransfers", name: "Game Point Transfers", description: "Records of point transfers between users." },
  { id: "Gauntlet", name: "Gauntlet Data", description: "Data from player-vs-player Gauntlet matches." },
  { id: "Survey", name: "Survey Data", description: "User-created surveys and their responses." },
  { id: "Stack", name: "Stack Data", description: "Questions and answers from the Stack section." },
  { id: "Contributions", name: "Contributions Data", description: "User contribution metrics for Random Payables." },
  { id: "Content", name: "User Content", description: "Saved instruments, sketches, and visualizations." },
  { id: "Sandbox", name: "Sandbox Data", description: "Data from GameLab's testing sandbox environment." },
  { id: "Sketch Data", name: "Sketch Data", description: "Data from user-saved GameLab sketches (games, sessions, and gameplay)." },
  { id: "Peer Reviews", name: "Peer Reviews", description: "Merged peer reviews (pull requests) for published games." },
  { id: "Codebases", name: "Codebases", description: "Uploaded source code versions for published games." },
];

const BASE_DATALAB_CODER_SYSTEM_PROMPT_TEMPLATE = `You are an AI assistant specialized in creating D3.js visualizations and exporting data for a citizen science gaming platform. You have access to data from MongoDB and PostgreSQL based on the user's selection.

### Primary Rule: Use Provided Data
IMPORTANT: The data is ALREADY PROVIDED to you in the \`dataContext\` variable when you generate code. DO NOT generate code that fetches data using \`d3.json()\` or any other external data fetching methods. All data must be used from the \`dataContext\` variable.

### Data Context Overview
The user can select from these data categories: %%DATALAB_AVAILABLE_DATA_CATEGORIES%%
A general set of keys that *might* be available in the \`dataContext\` includes: %%DATALAB_GENERAL_SCHEMA_OVERVIEW%%

For the current user query, the exact available data keys in the \`dataContext\` are: %%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%
Use these specific keys to access data. For example: \`dataContext.gameSessions\`.
%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%

### Your Task
-   **If the user asks for a plot, chart, or visualization:** Generate D3.js code to create a visual representation of the data. Your code MUST perform any necessary calculations (like counting, grouping, or averaging) from the raw data provided in the \`dataContext\`.
-   **If the user asks for a 'data set', 'raw data', or 'JSON':** Generate D3.js code that displays the relevant data as a formatted JSON string.

---

### Mini-Tutorials & Advanced Examples

#### 1. Computing and Plotting Aggregated Time-Series Data
The \`dataContext\` provides raw data (e.g., \`dataContext.gameSessions\`). You MUST compute aggregations inside your D3 script.

**Example:** Count game sessions per day from \`dataContext.gameSessions\`.

\`\`\`javascript
// CORRECT: Compute the aggregate data yourself.
const sessionsByDate = d3.rollup(
  dataContext.gameSessions,
  v => v.length, // Count the number of sessions
  d => d.startTime.split('T')[0] // Group by date string (YYYY-MM-DD)
);

// Convert map to array for D3
const parsedData = Array.from(sessionsByDate, ([key, value]) => ({
  date: new Date(key),
  value: value
})).sort((a, b) => a.date - b.date);

// Now you can use a time scale, e.g., d3.scaleTime().domain(d3.extent(parsedData, d => d.date))
\`\`\`

#### 2. Calculating Averages and Joining Datasets
You need to calculate statistics like averages from raw data collections like \`dataContext.gameData\`.

**Example:** Calculate and plot the average score for each game.

\`\`\`javascript
// CORRECT: Calculate averages from raw gameData and create a lookup map for game names.
const gameNames = new Map(dataContext.games.map(g => [g.gameId, g.name]));

// Group gameData by gameId
const groupedData = d3.group(dataContext.gameData, d => d.gameId);

// Calculate the average score for each game
const dataWithAverages = Array.from(groupedData, ([gameId, rounds]) => {
  // Filter for rounds that have a finalScore and it is a number
  const validRounds = rounds.filter(r => r.roundData && typeof r.roundData.finalScore === 'number');
  const averageScore = validRounds.length > 0
    ? d3.mean(validRounds, r => r.roundData.finalScore)
    : 0;
  return {
    gameName: gameNames.get(gameId) || gameId,
    averageScore: averageScore
  };
});

// Now use 'd.gameName' for the axis labels and 'd.averageScore' for the values.
\`\`\`

#### 3. Calculating Cumulative Totals (Running Total)
For prompts like "visualize count over time," a cumulative line chart is often more useful than a daily bar chart.

**Example:** Calculating the cumulative count of user-created sketches over time.

\`\`\`javascript
// First, count sketches per day (similar to Example 1)
const sketchesByDate = d3.rollup(
  dataContext.userSketches,
  v => v.length,
  d => new Date(d.createdAt).toISOString().split('T')[0]
);
const sortedData = Array.from(sketchesByDate, ([key, value]) => ({ date: new Date(key), count: value }))
  .sort((a, b) => a.date - b.date);

// Now calculate the cumulative total
let runningTotal = 0;
const cumulativeData = sortedData.map(d => {
  runningTotal += d.count;
  return { date: d.date, cumulativeCount: runningTotal };
});
// Now plot 'cumulativeData' with 'd.cumulativeCount' on the y-axis.
\`\`\`

---

### Instructions for D3.js Visualizations (Full Example)
When creating visualizations, follow the structure below. Return ONLY the JavaScript code block.

\`\`\`javascript
// This is a full, runnable example. Use this structure to avoid generating incomplete code.

// Step 1: Access and prepare the data from the provided dataContext.
// Use a descriptive variable name and handle cases where data might be missing.
const sessions = dataContext.gameSessions || [];

// Step 2: Handle edge cases, like no data.
if (sessions.length === 0) {
  // Clear the container and show a message.
  d3.select(container).selectAll("*").remove();
  d3.select(container)
    .append("p")
    .style("text-align", "center")
    .style("padding", "20px")
    .text("No session data available for visualization based on your selection.");
  return; // IMPORTANT: return early if no data to prevent errors.
}

// Step 3: Define chart dimensions and margins.
const margin = { top: 20, right: 30, bottom: 40, left: 90 };
const width = container.clientWidth - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// Step 4: Create the SVG container.
// Remove any previous SVG to prevent re-rendering issues.
d3.select(container).selectAll("svg").remove();

const svg = d3.select(container)
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

// Step 5: Perform calculations and define scales.
// Example for a bar chart of game session counts.
const gameCounts = d3.rollup(sessions, v => v.length, d => d.gameId);
const gameCountsArray = Array.from(gameCounts, ([key, value]) => ({gameId: key, count: value}));

const x = d3.scaleLinear()
  .domain([0, d3.max(gameCountsArray, d => d.count)])
  .range([0, width]);

const y = d3.scaleBand()
  .domain(gameCountsArray.map(d => d.gameId))
  .range([0, height])
  .padding(0.1);

// Step 6: Add axes.
svg.append("g")
  .attr("transform", \`translate(0,\${height})\`)
  .call(d3.axisBottom(x));

svg.append("g")
  .call(d3.axisLeft(y));

// Step 7: Create and style the chart elements (bars, circles, lines, etc.).
svg.selectAll("myRect")
  .data(gameCountsArray)
  .join("rect")
  .attr("x", x(0) )
  .attr("y", d => y(d.gameId))
  .attr("width", d => x(d.count))
  .attr("height", y.bandwidth())
  .attr("fill", "#10B981"); // Emerald color
\`\`\`

---

### Instructions for Data Export
When a user asks for a dataset:
1.  Analyze what data is relevant from the \`dataContext\` (keys: %%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%).
2.  Generate D3 code that creates a \`<pre>\` element and displays the relevant data from \`dataContext\` as a formatted JSON string inside it.
3.  Return ONLY the JavaScript code for this D3.js script.

**Example for data export:**
\`\`\`javascript
// Access the requested data from the dataContext
const dataToDisplay = dataContext.pointTransfers || [];

// Clear the container before appending new content
d3.select(container).selectAll("*").remove();

// Display the data as a JSON string in a <pre> tag
d3.select(container)
  .append('pre')
  .style('font-size', '12px')
  .style('text-align', 'left')
  .text(JSON.stringify(dataToDisplay, null, 2));
\`\`\`

Return ONLY the JavaScript code. Do not include explanations unless specifically asked.
`;

const BASE_DATALAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI expert in D3.js code and data visualization. Your task is to review D3.js code that was generated by another AI assistant.
The initial AI was given a user's query, a system prompt, and access to a \`dataContext\` object containing raw, un-aggregated data.
Focus your review on:
1.  **Correctness:** Does the code run without errors? Does it accurately represent the data?
2.  **Data Usage & Computation:** Does the code correctly access data from the \`dataContext\` variable (e.g., \`dataContext.gameSessions\`)? Crucially, does the code perform its own aggregations and computations (e.g., using \`d3.rollup\`, \`d3.mean\`, etc.) since the context provides raw data? The code should NOT expect pre-computed summaries. It MUST NOT use \`d3.json()\` or other external data fetching methods.
3.  **D3 Best Practices:** Does the code follow D3.js conventions (selections, scales, axes, data binding)?
4.  **Efficiency:** Is the code reasonably efficient for the task?
5.  **Clarity and Readability:** Is the code well-structured and easy to understand?
6.  **Visualization Choices:** Is the chosen type of visualization appropriate for the data and the user's likely intent?
7.  **Aesthetics and Presentation:** Are labels, titles, and axes clear? Is the visual design (e.g., colors, layout) effective and appealing? (Emerald colors like #10B981 are preferred).
8.  **Error Handling:** Does the code gracefully handle potential issues like empty or malformed data in \`dataContext\`?

Provide constructive feedback. Be specific. If you find errors or areas for improvement, explain them and suggest concrete changes or alternatives.
Return only your review of the D3.js code.
`;

function sanitizeD3Code(code: string): string {
  const fixedCode = code.replace(/d3\.array\.(max|min|extent|sum)/g, 'd3.$1');
  const withSafetyChecks = `
  try {
    if (!container) { console.error("D3 Render: Container element not found"); return; }
    if (!d3) { console.error("D3 Render: D3 library not found"); if(container) { d3.select(container).text("D3 library not available."); } return; }
    if (typeof dataContext === 'undefined') { console.error("D3 Render: dataContext is not defined."); if(container) { d3.select(container).text("Data context not available."); } return; }
    ${fixedCode}
  } catch (error) {
    console.error("Error in D3 visualization:", error);
    if (container) {
      const vizContainer = d3.select(container);
      vizContainer.selectAll("*").remove(); 
      vizContainer.append("div").style("color", "red").style("padding", "20px").style("text-align", "center").text("Error rendering D3: " + error.message);
    }
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
  coderSystemPrompt: string | null, // Updated
  reviewerSystemPrompt: string | null, // New
  selectedDataTypes: string[],
  useCodeReview: boolean,
  selectedCoderModelId?: string,
  selectedReviewerModelId?: string
) {
  const response = await fetch("/api/datalab/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message,
      chatHistory: chatHistory.map((m: ChatMessage) => ({role: m.role, content: m.content})),
      coderSystemPrompt, // Updated
      reviewerSystemPrompt, // New
      selectedDataTypes,
      useCodeReview,
      selectedCoderModelId,
      selectedReviewerModelId
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
  const [currentCoderSystemPrompt, setCurrentCoderSystemPrompt] = useState<string | null>(null); // Renamed
  const [currentReviewerSystemPrompt, setCurrentReviewerSystemPrompt] = useState<string | null>(null); // New
  const [baseCoderTemplateWithContext, setBaseCoderTemplateWithContext] = useState<string | null>(null); // Renamed
  const [baseReviewerTemplateWithContext, setBaseReviewerTemplateWithContext] = useState<string | null>(null); // New
  const [isLoadingSystemPrompts, setIsLoadingSystemPrompts] = useState(true); // Combined

  const [showDbAccessOptions, setShowDbAccessOptions] = useState(false);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>(
    AVAILABLE_DATA_TYPES_UI.length > 0 ? [AVAILABLE_DATA_TYPES_UI[0].id] : []
  );
  const [useCodeReview, setUseCodeReview] = useState<boolean>(false);

  const { user, isSignedIn, isLoaded: isUserLoaded } = useUser();
  const [selectedCoderModel, setSelectedCoderModel] = useState<string>("");
  const [selectedReviewerModel, setSelectedReviewerModel] = useState<string>(""); 
  const [availableModels, setAvailableModels] = useState<ModelDefinition[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  const suggestedPrompts = [
    "Return the full dataset for recent point transfers as a JSON object (ensure Point Transfers data type is selected)",
    "Return the full dataset for recent game sessions as a JSON object (ensure Game Data data type is selected)",
    "Show me user contributions (ensure Contributions data type is selected)",
    "Plot the number of Stack questions and answers by date (ensure Stack Data data type is selected)",
  ];

  const initializeSystemPrompts = useCallback(async () => { // Renamed
    setIsLoadingSystemPrompts(true);
    try {
      const contextData = await fetchDatalabContextData();
      let populatedCoderPrompt = BASE_DATALAB_CODER_SYSTEM_PROMPT_TEMPLATE;
      let populatedReviewerPrompt = BASE_DATALAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE;
      
      const availableCategoriesString = JSON.stringify(contextData.availableDataCategories || ['Game', 'Survey', 'Stack', 'Contributions', 'Content', 'Sandbox']);
      const generalSchemaString = JSON.stringify(contextData.generalContextKeys || ['Not loaded']);
      const querySpecificKeysString = '(This will be filled by the backend based on your query)';
      const sandboxErrorNoteString = contextData.sandboxFetchErrorNote || '';

      [populatedCoderPrompt, populatedReviewerPrompt].forEach((_, index) => {
        let prompt = index === 0 ? populatedCoderPrompt : populatedReviewerPrompt;
        prompt = prompt.replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', availableCategoriesString);
        prompt = prompt.replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', generalSchemaString);
        prompt = prompt.replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', querySpecificKeysString);
        prompt = prompt.replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteString);
        if (index === 0) populatedCoderPrompt = prompt;
        else populatedReviewerPrompt = prompt;
      });
      
      setCurrentCoderSystemPrompt(populatedCoderPrompt);
      setBaseCoderTemplateWithContext(populatedCoderPrompt);
      setCurrentReviewerSystemPrompt(populatedReviewerPrompt);
      setBaseReviewerTemplateWithContext(populatedReviewerPrompt);

    } catch (err) {
      console.error("Error initializing DataLab system prompts:", err);
      const errorPrompt = (template: string) => template
        .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', 'Error loading categories.')
        .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', 'Error loading schema overview.')
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', '(Dynamic data based on query)')
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', '');
      
      setCurrentCoderSystemPrompt(errorPrompt(BASE_DATALAB_CODER_SYSTEM_PROMPT_TEMPLATE));
      setBaseCoderTemplateWithContext(errorPrompt(BASE_DATALAB_CODER_SYSTEM_PROMPT_TEMPLATE));
      setCurrentReviewerSystemPrompt(errorPrompt(BASE_DATALAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE));
      setBaseReviewerTemplateWithContext(errorPrompt(BASE_DATALAB_REVIEWER_SYSTEM_PROMPT_TEMPLATE));
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
          console.error("Failed to fetch available models for DataLabPage:", error);
          setAvailableModels(getAvailableModelsForUser(false));
        } finally {
          setIsLoadingModels(false);
        }
      }
    }
    fetchModelsForUser();
  }, [isUserLoaded, isSignedIn, user]);

  const { mutate, isPending } = useMutation<DataLabApiResponse, Error, { message: string; chatHistory: ChatMessage[]; coderSystemPrompt: string | null; reviewerSystemPrompt: string | null; selectedDataTypes: string[]; useCodeReview: boolean, selectedCoderModelId?: string, selectedReviewerModelId?: string }>({
    mutationFn: (vars) => sendChatMessageToApi(vars.message, vars.chatHistory, vars.coderSystemPrompt, vars.reviewerSystemPrompt, vars.selectedDataTypes, vars.useCodeReview, vars.selectedCoderModelId, vars.selectedReviewerModelId),
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
        setCurrentDataContext(data.dataContext);
        renderD3Plot(data.code, data.dataContext);
      } else if (data.code && !data.dataContext) { 
        setCurrentCode(data.code); 
        setCurrentDataContext(null);
        if (data.code.includes("d3.select") || data.code.includes("new Function")) {
            renderD3Plot(data.code, null); 
        } else {
            if (plotRef.current) d3.select(plotRef.current).selectAll("*").remove();
        }
      } else if (data.error) {
         setVisualizationError(data.error);
         toast.error(data.error);
         if (plotRef.current) d3.select(plotRef.current).selectAll("*").remove(); 
      }
      if (data.limitReached) {
          toast.error(data.error || "Monthly API request limit reached.");
      }
    },
    onError: (error: Error) => {
      setMessages(prev => [...prev, {role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date()}]);
      setVisualizationError("Failed to generate visualization: " + error.message);
      toast.error("Failed to generate visualization: " + error.message);
      if (plotRef.current) d3.select(plotRef.current).selectAll("*").remove();
    }
  });

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
      const plotFunction = new Function('d3', 'container', 'dataContext', safeCode);
      plotFunction(d3, plotRef.current, dataCtx);
    } catch (error) {
      const errorMessage = `Error rendering D3 plot: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setVisualizationError(errorMessage);
      try {
        if (plotRef.current) { 
            d3.select(plotRef.current).append("div").style("color", "red").style("padding", "20px").style("text-align", "center").text(errorMessage);
        }
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
    mutate({ 
        message: inputMessage, 
        chatHistory: messages, 
        coderSystemPrompt: currentCoderSystemPrompt, 
        reviewerSystemPrompt: useCodeReview ? currentReviewerSystemPrompt : null,
        selectedDataTypes, 
        useCodeReview, 
        selectedCoderModelId: selectedCoderModel || undefined,
        selectedReviewerModelId: useCodeReview && selectedReviewerModel ? (selectedReviewerModel || undefined) : undefined
    });
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
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
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

          <form onSubmit={handleSubmit} className="p-4 border-t bg-white overflow-auto">
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
              
              <div className="mt-2">
                <label htmlFor="modelSelectorCoderDataLab" className="block text-xs font-medium text-gray-600">
                  {useCodeReview ? "Coder Model" : "AI Model"} (Optional)
                </label>
                <select
                  id="modelSelectorCoderDataLab"
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
                  <label htmlFor="modelSelectorReviewerDataLab" className="block text-xs font-medium text-gray-600">
                    Reviewer Model (Optional)
                  </label>
                  <select
                    id="modelSelectorReviewerDataLab"
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

              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="useCodeReviewDataLab"
                  checked={useCodeReview}
                  onChange={(e) => {
                      setUseCodeReview(e.target.checked);
                      setSelectedCoderModel("");
                      setSelectedReviewerModel("");
                  }}
                  className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="useCodeReviewDataLab" className="ml-2 text-sm text-gray-700">
                  Enable AI Code Review (experimental)
                </label>
              </div>
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
                {showSystemPromptEditor ? "▼ Hide System Prompts" : "▶ Show System Prompts"}
              </button>
              {showSystemPromptEditor && (
                 <div className="mt-1 space-y-3">
                  {isLoadingSystemPrompts ? (
                     <div className="flex items-center text-xs text-gray-500">
                       <Spinner className="w-3 h-3 mr-1" /> Loading default prompts...
                     </div>
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
            <h2 className="text-2xl font-bold text-emerald-700">Visualization</h2>
            <div className="space-x-2">
              <button 
                onClick={() => setShowCode(!showCode)} 
                className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                {showCode ? 'Hide Details' : 'Show Details'}
              </button>
              {currentCode && <SaveVisualizationButton code={currentCode} />}
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg flex-grow min-h-[300px] flex items-center justify-center relative shadow-inner overflow-hidden">
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
            <div className="flex flex-col space-y-2 overflow-y-auto flex-shrink-0 max-h-[calc(100%-300px-3rem-1.5rem-1rem)]">
              {currentCode && (
                <div className="bg-gray-900 text-gray-300 p-3 rounded-lg">
                   <h4 className="text-sm font-semibold text-gray-200 mb-1">Generated D3 Code:</h4>
                  <pre className="text-xs whitespace-pre-wrap"><code>{currentCode}</code></pre>
                </div>
              )}
              {currentDataContext && (
                <div className="bg-gray-800 text-gray-400 p-3 rounded-lg">
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