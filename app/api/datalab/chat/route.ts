import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";
import { fetchRelevantData, DATA_TYPES } from "./datalabHelper"; // Import from helper

// Fallback system prompt template if frontend sends an empty one.
// Placeholders %%DATALAB_AVAILABLE_DATA_CATEGORIES%%, %%DATALAB_GENERAL_SCHEMA_OVERVIEW%%,
// %%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%, and %%DATALAB_SANDBOX_FETCH_ERROR_NOTE%% will be resolved here.
const FALLBACK_DATALAB_SYSTEM_PROMPT_TEMPLATE = `
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

const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

function createModelRequest(model: string, messages: any[]) {
  return {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: model.includes('o4-mini') ? 4000 : 2000,
  };
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `customSystemPrompt` is the user-edited prompt from the frontend.
    // It should have Type A placeholders resolved by the frontend.
    const { message: userQuery, chatHistory, customSystemPrompt, selectedDataTypes } = await request.json();
    
    const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id);
    
    if (!canUseApi) {
      return NextResponse.json({ 
        error: "Monthly API request limit reached. Please upgrade your plan.", 
        limitReached: true 
      }, { status: 403 });
    }
    
    const userId = clerkUser.id;
    
    // Fetch Type B data (query-specific data context)
    const querySpecificDataContext = await fetchRelevantData(userQuery, userId, selectedDataTypes);
    const querySpecificContextKeys = Object.keys(querySpecificDataContext);
    const sandboxErrorNoteForPrompt = querySpecificDataContext.sandboxFetchError 
        ? `Note: Sandbox data could not be fetched for this query: ${querySpecificDataContext.sandboxFetchError}` 
        : '';

    let finalSystemPrompt: string;

    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      // Use the prompt from the frontend (Type A already resolved by frontend)
      // Resolve Type B placeholders
      finalSystemPrompt = customSystemPrompt
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);

      // Safety net: If Type A placeholders are still there, resolve them.
      // This should ideally be handled by the frontend.
      if (finalSystemPrompt.includes('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%') || finalSystemPrompt.includes('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%')) {
        console.warn("DataLab Chat API: Frontend-provided system prompt still contains Type A placeholders. Resolving now.");
        // Fetch general context again (or use a cached version if available/implemented)
        const generalContext = await fetchRelevantData("general overview", userId, Object.values(DATA_TYPES));
        finalSystemPrompt = finalSystemPrompt
          .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
          .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContext)));
      }

    } else {
      // Frontend sent no custom prompt, use backend's fallback template
      console.log("DataLab Chat API: No customSystemPrompt from frontend, using fallback.");
      const generalContextForFallback = await fetchRelevantData("general overview", userId, Object.values(DATA_TYPES));
      finalSystemPrompt = FALLBACK_DATALAB_SYSTEM_PROMPT_TEMPLATE
        .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
        .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContextForFallback)))
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);
    }
    
    const messagesToAI = [
      { role: "system", content: finalSystemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      // Add the data categories to the user message for the AI's direct attention to what's selected for this query
      { role: "user", content: `Selected data types for this query: ${selectedDataTypes?.join(', ') || 'Default (Game Data)'}. User's request: ${userQuery}` }
    ];

    const response = await openAI.chat.completions.create(
      createModelRequest(model, messagesToAI as any)
    );

    await incrementApiUsage(clerkUser.id);

    const aiResponseContent = response.choices[0].message.content!;
    let code = "";
    let message_text = aiResponseContent;

    const codeMatch = aiResponseContent.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      code = codeMatch[1].trim();
      message_text = aiResponseContent.replace(/```(?:javascript|js)?\n[\s\S]*?```/, "").trim();
    } else if (aiResponseContent.includes("d3.select") && aiResponseContent.includes("svg")) {
      code = aiResponseContent; // Assume whole response is code
      message_text = "Generated D3.js visualization code:";
    }
    
    return NextResponse.json({
      message: message_text,
      code: code,
      dataContext: querySpecificDataContext, // Return the query-specific data context
      remainingRequests
    });
        
  } catch (error: any) {
    console.error("Error in DataLab chat:", error);
    return NextResponse.json(
      { error: "Failed to generate visualization", details: error.message },
      { status: 500 }
    );
  }
}