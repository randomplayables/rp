import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma"; // Import prisma
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";
import { fetchRelevantData, DATA_TYPES } from "./datalabHelper";

// Fallback system prompt template (remains the same)
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
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://randomplayables.com",
    "X-Title": "randomplayables",
  },
});

// Helper function to call OpenAI API
async function callOpenAIChat(modelName: string, messages: any[], customMaxTokens?: number) {
  const max_tokens = customMaxTokens ?? (modelName.includes('o4-mini') ? 4000 : 2000); // [cite: 10]
  // Image content type is not used by DataLab, so we can simplify message structure if needed,
  // but the current APIs seem to handle text-only fine.
  // For models like 'openai/o4-mini-high' or 'google/gemini-2.5-flash-preview-05-20' if they were multimodal,
  // the message content would need to be an array of objects like: [{"type": "text", "text": "What is in this image?"}]
  // However, for text-only input, a simple string content is also accepted by OpenAI API.
  // The examples show string content for llama and deepseek [cite: 22, 25]
  // and array content for o4-mini and gemini flash, though those examples include images [cite: 13, 17]
  // The existing code sends messagesToAI as [{role: "system", content: string}, {role: "user", content: string}] which works.
  
  const messagesForApi = messages.map(msg => {
    if (typeof msg.content === 'string') {
        // For models expecting simple text content
        if (modelName.startsWith("meta-llama/") || modelName.startsWith("deepseek/")) {
            return { role: msg.role, content: msg.content };
        }
        // For multimodal models expecting an array, wrap text content
        return { role: msg.role, content: [{ type: "text", text: msg.content }] };
    }
    return msg; // If content is already in the array format
  });
  
  return openAI.chat.completions.create({
    model: modelName,
    messages: messagesForApi as any, // Cast to any if OpenAI types conflict
    temperature: 0.7,
    max_tokens: max_tokens,
  });
}

function extractCodeFromResponse(aiResponseContent: string | null, defaultMessage: string = "AI response:"): { code: string; message_text: string } {
  if (!aiResponseContent) {
    return { code: "", message_text: "No content from AI." };
  }

  let code = "";
  let message_text = aiResponseContent;

  const codeMatch = aiResponseContent.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
  if (codeMatch && codeMatch[1]) {
    code = codeMatch[1].trim();
    message_text = aiResponseContent.replace(/```(?:javascript|js)?\n[\s\S]*?```/, "").trim();
    if (!message_text) message_text = "Generated D3.js code with review.";
  } else if (aiResponseContent.includes("d3.select") && (aiResponseContent.includes("svg") || aiResponseContent.includes("container"))) {
    // If no markdown block, but looks like D3 code, assume the whole response is code.
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

    const { message: userQuery, chatHistory, customSystemPrompt, selectedDataTypes, useCodeReview } = await request.json();
    
    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;
    
    const userId = clerkUser.id;
    
    // Fetch Type B data (query-specific data context) - Common for both flows
    const querySpecificDataContext = await fetchRelevantData(userQuery, userId, selectedDataTypes);
    const querySpecificContextKeys = Object.keys(querySpecificDataContext);
    const sandboxErrorNoteForPrompt = querySpecificDataContext.sandboxFetchError 
        ? `Note: Sandbox data could not be fetched for this query: ${querySpecificDataContext.sandboxFetchError}` 
        : '';

    let finalSystemPrompt: string;

    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      finalSystemPrompt = customSystemPrompt
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);

      if (finalSystemPrompt.includes('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%') || finalSystemPrompt.includes('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%')) {
        console.warn("DataLab Chat API: Frontend-provided system prompt still contains Type A placeholders. Resolving now.");
        const generalContext = await fetchRelevantData("general overview", userId, Object.values(DATA_TYPES));
        finalSystemPrompt = finalSystemPrompt
          .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
          .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContext)));
      }
    } else {
      console.log("DataLab Chat API: No customSystemPrompt from frontend, using fallback.");
      const generalContextForFallback = await fetchRelevantData("general overview", userId, Object.values(DATA_TYPES));
      finalSystemPrompt = FALLBACK_DATALAB_SYSTEM_PROMPT_TEMPLATE
        .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
        .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContextForFallback)))
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);
    }
    
    let finalApiResponse: { message: string; code?: string; dataContext?: any; remainingRequests?: number; };

    // --- Construct messages for Chatbot1 (common part for initial generation) ---
    const initialUserMessages = [
        ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
        { role: "user", content: `Selected data types for this query: ${selectedDataTypes?.join(', ') || 'Default (Game Data)'}. User's request: ${userQuery}` }
    ];
    const systemMessage = { role: "system", content: finalSystemPrompt };

    if (useCodeReview) { // [cite: 8]
      const chatbot1Model = isSubscribed ? "openai/o4-mini-high" : "meta-llama/llama-3.3-8b-instruct:free"; // [cite: 10, 19]
      const chatbot2Model = isSubscribed ? "google/gemini-2.5-flash-preview-05-20" : "deepseek/deepseek-r1-0528:free"; // [cite: 10, 19]
      
      // 1. Chatbot1 generates initial code
      const messagesToChatbot1Initial = [systemMessage, ...initialUserMessages];
      const response1 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Initial);
      const initialGenerationContent = response1.choices[0].message.content;
      const { code: initialCode, message_text: initialMessageText } = extractCodeFromResponse(initialGenerationContent, "Initial code generated by Chatbot1.");

      if (!initialCode.trim()) {
        // If Chatbot1 failed to generate code, return its response directly without review.
        finalApiResponse = {
            message: `Chatbot1 (Model: ${chatbot1Model}) did not produce code in the first pass. Response: ${initialMessageText}`,
            code: "",
            dataContext: querySpecificDataContext,
        };
      } else {
        // 2. Chatbot2 reviews the code [cite: 8]
        const reviewPrompt = `
          You are an expert code reviewer. Review the following D3.js code generated by another AI (Chatbot1).
          The code is intended to create a visualization based on the user's request and available data context.
          Please look for:
          - Bugs, syntax errors, or logical errors in the D3.js code.
          - Reasons why the code might not work or might produce incorrect visualizations.
          - Issues with data access (it should use a \`dataContext\` variable).
          - Adherence to D3.js best practices and the specific requirements mentioned in the system prompt for Chatbot1.
          - Clarity, efficiency, and potential improvements.

          Provide concise and actionable feedback.

          Original User Prompt to Chatbot1:
          ---
          ${userQuery}
          ---

          System Prompt used for Chatbot1:
          ---
          ${finalSystemPrompt}
          ---

          Code generated by Chatbot1:
          ---
          \`\`\`javascript
          ${initialCode}
          \`\`\`
          ---
          Your review:
        `;
        const messagesToChatbot2 = [{ role: "user", content: reviewPrompt }];
        const response2 = await callOpenAIChat(chatbot2Model, messagesToChatbot2);
        const reviewFromChatbot2 = response2.choices[0].message.content || "No review feedback provided.";

        // 3. Chatbot1 revises the code based on review [cite: 9]
        const revisionPrompt = `
          You are an AI assistant that generated the initial D3.js code below.
          Another AI (Chatbot2) has reviewed your code and provided the following feedback.
          Please carefully consider the feedback and revise your original D3.js code to address the points raised.
          Ensure the revised code still accurately addresses the original user prompt and adheres to ALL requirements in the original system prompt you received.
          Output ONLY the complete, revised JavaScript code block for the D3.js visualization. Do not include any other explanatory text or markdown formatting outside the code block.

          Original User Prompt:
          ---
          ${userQuery}
          ---

          Original System Prompt You Followed:
          ---
          ${finalSystemPrompt}
          ---

          Your Initial D3.js Code:
          ---
          \`\`\`javascript
          ${initialCode}
          \`\`\`
          ---

          Chatbot2's Review of Your Code:
          ---
          ${reviewFromChatbot2}
          ---

          Your Revised D3.js Code (only the JavaScript code block):
        `;
        // For revision, we might only need the system prompt and the user message containing all context.
        const messagesToChatbot1Revision = [
          systemMessage, 
          { role: "user", content: revisionPrompt }
        ];
        const response3 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Revision);
        const revisedGenerationContent = response3.choices[0].message.content; // [cite: 9]
        const { code: revisedCode, message_text: revisedMessageText } = extractCodeFromResponse(revisedGenerationContent, "Code revised by Chatbot1.");
        
        finalApiResponse = {
          message: `Code generated with review. Initial AI message: "${initialMessageText}". Review: "${reviewFromChatbot2}". Final AI message: "${revisedMessageText}"`,
          code: revisedCode,
          dataContext: querySpecificDataContext,
        };
      }

    } else {
      // Original Flow (No Code Review)
      const { model, canUseApi, remainingRequests: modelSelectionRemaining } = await getModelForUser(clerkUser.id);
    
      if (!canUseApi) {
        return NextResponse.json({ 
          error: "Monthly API request limit reached. Please upgrade your plan.", 
          limitReached: true 
        }, { status: 403 });
      }
      
      const messagesToAI = [systemMessage, ...initialUserMessages];
      
      const response = await callOpenAIChat(model, messagesToAI);
      const aiResponseContent = response.choices[0].message.content;
      const { code, message_text } = extractCodeFromResponse(aiResponseContent, "Generated D3.js visualization code.");
    
      finalApiResponse = {
        message: message_text,
        code: code,
        dataContext: querySpecificDataContext,
        remainingRequests: modelSelectionRemaining
      };
    }

    await incrementApiUsage(clerkUser.id);
    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    const remainingRequestsAfterIncrement = Math.max(0, (usageData?.monthlyLimit || 0) - (usageData?.usageCount || 0));
    finalApiResponse.remainingRequests = remainingRequestsAfterIncrement;
    
    return NextResponse.json(finalApiResponse);
        
  } catch (error: any) {
    console.error("Error in DataLab chat:", error);
    let errorDetails = error.message;
    if (error.response && error.response.data && error.response.data.error) {
        errorDetails = error.response.data.error.message || error.message;
    }
    return NextResponse.json(
      { error: "Failed to generate visualization", details: errorDetails, stack: error.stack },
      { status: 500 }
    );
  }
}