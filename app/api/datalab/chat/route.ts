import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { fetchRelevantData, DATA_TYPES } from "./datalabHelper";
import { callOpenAIChat } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

const FALLBACK_DATALAB_CODER_SYSTEM_PROMPT_TEMPLATE = `You are an AI assistant specialized in creating D3.js visualizations and exporting data for a citizen science gaming platform. You have access to data from MongoDB and PostgreSQL based on the user's selection.

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

function getMonthlyLimitForTier(tier?: string | null): number {
  switch (tier) {
    case "premium":
      return 500;
    case "premium_plus":
      return 1500;
    default:
      return 100;
  }
}

function extractCodeFromResponse(aiResponseContent: string | null, defaultMessage: string = "AI response:"): { code: string; message_text: string } {
  if (!aiResponseContent) return { code: "", message_text: "No content from AI." };
  let code = "";
  let message_text = aiResponseContent;
  const codeMatch = aiResponseContent.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
  if (codeMatch && codeMatch[1]) {
    code = codeMatch[1].trim();
    message_text = aiResponseContent.replace(/```(?:javascript|js)?\n[\s\S]*?```/, "").trim() || "Generated D3.js code.";
  } else if (aiResponseContent.includes("d3.select") && (aiResponseContent.includes("svg") || aiResponseContent.includes("container"))) {
    code = aiResponseContent;
    message_text = defaultMessage;
  }
  return { code, message_text };
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { 
        message: userQuery, 
        chatHistory, 
        coderSystemPrompt, // Renamed
        selectedDataTypes, 
        selectedCoderModelId, 
    } = await request.json();

    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true, subscriptionTier: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;

    const querySpecificDataContext = await fetchRelevantData(userQuery, clerkUser.id, selectedDataTypes);
    const querySpecificContextKeys = Object.keys(querySpecificDataContext);
    const sandboxErrorNoteForPrompt = querySpecificDataContext.sandboxFetchError ? `Note: Sandbox data error: ${querySpecificDataContext.sandboxFetchError}` : '';

    let coderSystemPromptToUse: string;
    if (coderSystemPrompt && coderSystemPrompt.trim() !== "") {
      coderSystemPromptToUse = coderSystemPrompt
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);
      if (coderSystemPromptToUse.includes('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%') || coderSystemPromptToUse.includes('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%')) {
        const generalContext = await fetchRelevantData("general overview", clerkUser.id, Object.values(DATA_TYPES));
        coderSystemPromptToUse = coderSystemPromptToUse
          .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
          .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContext)));
      }
    } else {
      const generalContextForFallback = await fetchRelevantData("general overview", clerkUser.id, Object.values(DATA_TYPES));
      coderSystemPromptToUse = FALLBACK_DATALAB_CODER_SYSTEM_PROMPT_TEMPLATE
        .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
        .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContextForFallback)))
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);
    }
    
    let finalApiResponse: { message: string; code?: string; dataContext?: any; remainingRequests?: number; error?: string; limitReached?: boolean };

    const initialUserMessages: ChatCompletionMessageParam[] = [
        ...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]),
        { role: "user", content: `Selected data types for this query: ${selectedDataTypes?.join(', ') || 'Default (Game Data)'}. User's request: ${userQuery}` }
    ];
    const coderSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: coderSystemPromptToUse };
    
    const modelResolution = await resolveModelsForChat(
        clerkUser.id, 
        isSubscribed, 
        false, 
        selectedCoderModelId, 
        null
    );

    if (!modelResolution.canUseApi || modelResolution.limitReached) {
      return NextResponse.json({
        error: modelResolution.error || "Monthly API request limit reached.",
        limitReached: true,
        dataContext: querySpecificDataContext
      }, { status: modelResolution.limitReached ? 403 : 400 });
    }
    if (modelResolution.error) {
        return NextResponse.json({ error: modelResolution.error, dataContext: querySpecificDataContext }, { status: 400 });
    }

    if (!modelResolution.chatbot1Model) {
      console.error("DataLab API: Primary model not resolved properly for user", clerkUser.id);
      return NextResponse.json({ error: "Failed to resolve model.", dataContext: querySpecificDataContext }, { status: 500 });
    }
    const modelToUse = modelResolution.chatbot1Model;
    const messagesToAI: ChatCompletionMessageParam[] = [coderSystemMessage, ...initialUserMessages];
    const response = await callOpenAIChat(modelToUse, messagesToAI);
    const aiResponseContent = response.choices[0].message.content;
    const { code, message_text } = extractCodeFromResponse(aiResponseContent, "Generated D3.js visualization code.");
    finalApiResponse = { message: message_text, code: code };


    finalApiResponse.dataContext = querySpecificDataContext;
    
    const incrementParams: IncrementApiUsageParams = {
        userId: clerkUser.id,
        isSubscribed: isSubscribed,
        useCodeReview: false,
        coderModelId: modelResolution.chatbot1Model,
        reviewerModelId: null
    };
    await incrementApiUsage(incrementParams);

    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    if (usageData) {
        finalApiResponse.remainingRequests = Math.max(0, (usageData.monthlyLimit) - (usageData.usageCount));
    } else {
        const limitForUser = getMonthlyLimitForTier(profile?.subscriptionTier);
        finalApiResponse.remainingRequests = limitForUser;
    }

    return NextResponse.json(finalApiResponse);

  } catch (error: any) {
    console.error("Error in DataLab chat:", error);
    const dataContextForError = (error as any).dataContext || null; 
    return NextResponse.json(
      { 
        error: "Failed to generate visualization", 
        details: error.message, 
        stack: error.stack,
        ...(dataContextForError && { dataContext: dataContextForError }) 
      }, 
      { status: 500 }
    );
  }
}