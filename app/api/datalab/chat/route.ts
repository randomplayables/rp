import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { fetchRelevantData, DATA_TYPES } from "./datalabHelper";
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
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

const FALLBACK_DATALAB_REVIEWER_SYSTEM_PROMPT = `
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
        reviewerSystemPrompt, // New
        selectedDataTypes, 
        useCodeReview, 
        selectedCoderModelId, 
        selectedReviewerModelId 
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

    let reviewerSystemPromptToUse: string | null = null;
    if (useCodeReview) {
        let prompt: string;
        
        if (reviewerSystemPrompt && reviewerSystemPrompt.trim() !== "") {
            prompt = reviewerSystemPrompt
              .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
              .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);
              
            if (prompt.includes('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%') || prompt.includes('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%')) {
                const generalContext = await fetchRelevantData("general overview", clerkUser.id, Object.values(DATA_TYPES));
                prompt = prompt
                    .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
                    .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContext)));
            }
        } else {
            const generalContextForFallback = await fetchRelevantData("general overview", clerkUser.id, Object.values(DATA_TYPES));
            prompt = FALLBACK_DATALAB_REVIEWER_SYSTEM_PROMPT
                .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
                .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContextForFallback)))
                .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
                .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);
        }
        
        reviewerSystemPromptToUse = prompt;
    }

    let finalApiResponse: { message: string; code?: string; dataContext?: any; remainingRequests?: number; error?: string; limitReached?: boolean };

    const initialUserMessages: ChatCompletionMessageParam[] = [
        ...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]),
        { role: "user", content: `Selected data types for this query: ${selectedDataTypes?.join(', ') || 'Default (Game Data)'}. User's request: ${userQuery}` }
    ];
    const coderSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: coderSystemPromptToUse };
    const reviewerSystemMessage: ChatCompletionSystemMessageParam | null = reviewerSystemPromptToUse ? { role: "system", content: reviewerSystemPromptToUse } : null;
    
    const modelResolution = await resolveModelsForChat(
        clerkUser.id, 
        isSubscribed, 
        useCodeReview, 
        selectedCoderModelId, 
        selectedReviewerModelId
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

    if (useCodeReview) {
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        console.error("DataLab API: Code review models not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve models for code review.", dataContext: querySpecificDataContext }, { status: 500 });
      }
      const chatbot1ModelToUse = modelResolution.chatbot1Model;
      const chatbot2ModelToUse = modelResolution.chatbot2Model;

      // The user message to the reviewer includes the coder's system prompt for context
      const createReviewerPrompt = (initialGenerationContent: string | null): string => `
You are reviewing D3.js code. Below is the original user request, the system prompt given to the AI that generated the code, and the code itself.
The data for the visualization is expected to be in a \`dataContext\` variable.
Your task is to provide a critical review based on the system prompt you (the reviewer) received separately.

Original User Request to Initial AI (Chatbot1):
---
Selected data types for this query: ${selectedDataTypes?.join(', ') || 'Default (Game Data)'}. User's request: ${userQuery}
---
System Prompt used for Initial AI (Chatbot1):
---
${coderSystemPromptToUse}
---
D3.js Code generated by Initial AI (Chatbot1):
---
\`\`\`javascript
${extractCodeFromResponse(initialGenerationContent).code || "Chatbot1 did not produce reviewable code."}
\`\`\`
---
Your review of the D3.js code (focus on correctness, data usage from \`dataContext\`, D3 best practices, efficiency, readability, visualization choice, aesthetics, and error handling based on your reviewer system prompt):`;

      // The user message to the coder for revision includes its original system prompt for context
      const createRevisionPrompt = (initialGenerationContent: string | null, reviewFromChatbot2: string | null): string => `
You are the AI assistant that generated D3.js code. Your previous work was reviewed by another AI.
Based on the review, please revise your D3.js code. Remember to use data from the \`dataContext\` variable.

Original User Request:
---
Selected data types for this query: ${selectedDataTypes?.join(', ') || 'Default (Game Data)'}. User's request: ${userQuery}
---
Original System Prompt You Followed:
---
${coderSystemPromptToUse}
---
Your Initial D3.js Code:
---
\`\`\`javascript
${extractCodeFromResponse(initialGenerationContent).code || "No initial code."}
\`\`\`
---
Review of Your Code (from Chatbot2):
---
${reviewFromChatbot2 || "No review feedback provided."}
---
Your Revised D3.js Code (only the JavaScript code block, ensure it uses \`dataContext\` correctly):`;
      
      const reviewCycleOutputs: AiReviewCycleRawOutputs = await performAiReviewCycle(
        chatbot1ModelToUse, 
        coderSystemMessage, 
        initialUserMessages, 
        chatbot2ModelToUse, 
        reviewerSystemMessage,
        createReviewerPrompt, 
        createRevisionPrompt
      );
      
      const { code: initialCode, message_text: initialMessageText } = extractCodeFromResponse(reviewCycleOutputs.chatbot1InitialResponse.content);
      const { code: revisedCode, message_text: revisedMessageText } = extractCodeFromResponse(reviewCycleOutputs.chatbot1RevisionResponse.content, "Code revised by Chatbot1.");

      if (!initialCode.trim() && !revisedCode.trim()) {
         finalApiResponse = {
            message: `Chatbot1 (Model: ${chatbot1ModelToUse}) did not produce code. Initial response: ${initialMessageText || reviewCycleOutputs.chatbot1InitialResponse.content}. Revision attempt also failed. Reviewer (Model: ${chatbot2ModelToUse}) said: ${reviewCycleOutputs.chatbot2ReviewResponse.content || "No review content."}`,
            code: "",
        };
      } else {
        finalApiResponse = {
          message: `Code generated with review. Initial response: "${initialMessageText}". Reviewer (Model: ${chatbot2ModelToUse}) said: "${reviewCycleOutputs.chatbot2ReviewResponse.content || "No review content."}". Final AI response: "${revisedMessageText}"`,
          code: revisedCode || initialCode,
        };
      }
    } else {
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
    }

    finalApiResponse.dataContext = querySpecificDataContext;
    
    const incrementParams: IncrementApiUsageParams = {
        userId: clerkUser.id,
        isSubscribed: isSubscribed,
        useCodeReview: useCodeReview,
        coderModelId: modelResolution.chatbot1Model,
        reviewerModelId: useCodeReview ? modelResolution.chatbot2Model : null
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