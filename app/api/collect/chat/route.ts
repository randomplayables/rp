import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma"; // Import prisma
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";

// Default system prompt template (remains the same)
const FALLBACK_SYSTEM_PROMPT_TEMPLATE = `
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

// Reusable function to fetch game data (Type A)
async function fetchActiveGamesList() {
  await connectToDatabase();
  const games = await GameModel.find({}, {
    id: 1, name: 1, description: 1, _id: 0
  }).limit(10).lean();
  return games;
}

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
  const max_tokens = customMaxTokens ?? (modelName.includes('o4-mini') ? 4000 : 2000);
  const messagesForApi = messages.map(msg => {
    if (typeof msg.content === 'string') {
        if (modelName.startsWith("meta-llama/") || modelName.startsWith("deepseek/")) {
            return { role: msg.role, content: msg.content };
        }
        return { role: msg.role, content: [{ type: "text", text: msg.content }] };
    }
    return msg;
  });
  
  return openAI.chat.completions.create({
    model: modelName,
    messages: messagesForApi as any,
    temperature: 0.7,
    max_tokens: max_tokens,
  });
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // MODIFIED: Include useCodeReview
    const { message: userQuery, chatHistory, customSystemPrompt, useCodeReview } = await request.json();
    
    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;
    
    // --- Prepare System Prompt (common logic) ---
    let finalSystemPrompt: string;
    // Fetch Type A data (games list) - common for both flows
    const games = await fetchActiveGamesList();
    const gamesListString = JSON.stringify(games, null, 2);

    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      finalSystemPrompt = customSystemPrompt;
      if (finalSystemPrompt.includes("%%AVAILABLE_GAMES_LIST%%")) {
        console.warn("Collect Chat API: Frontend-provided system prompt still contains %%AVAILABLE_GAMES_LIST%%. Resolving now.");
        finalSystemPrompt = finalSystemPrompt.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
      }
    } else {
      console.log("Collect Chat API: No customSystemPrompt from frontend, using fallback template.");
      finalSystemPrompt = FALLBACK_SYSTEM_PROMPT_TEMPLATE.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
    }
    // --- End System Prompt Preparation ---
    
    let finalApiResponse: { message: string; remainingRequests?: number; };
    
    const initialUserMessages = [
        ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
        { role: "user", content: userQuery }
    ];
    const systemMessage = { role: "system", content: finalSystemPrompt };

    if (useCodeReview) {
      const chatbot1Model = isSubscribed ? "openai/o4-mini-high" : "meta-llama/llama-3.3-8b-instruct:free";
      const chatbot2Model = isSubscribed ? "google/gemini-2.5-flash-preview-05-20" : "deepseek/deepseek-r1-0528:free";

      // 1. Chatbot1 generates initial survey design
      const messagesToChatbot1Initial = [systemMessage, ...initialUserMessages];
      const response1 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Initial);
      const initialSurveyDesign = response1.choices[0].message.content || "Chatbot1 did not provide an initial survey design.";

      // 2. Chatbot2 reviews the survey design
      const reviewPrompt = `
        You are an expert survey design reviewer. Review the following survey design generated by Chatbot1.
        The survey is for the RandomPlayables platform and may involve game integrations.
        Please look for:
        - Clarity and effectiveness of questions.
        - Appropriateness of question types (multiple choice, Likert, text, game integration).
        - Logical flow and organization of the survey.
        - Potential biases in questions.
        - Soundness of game integration logic, if proposed.
        - Completeness based on the user's request.
        - Adherence to the system prompt provided to Chatbot1.

        Provide concise and actionable feedback for improving the survey design.

        Original User Prompt to Chatbot1:
        ---
        ${userQuery}
        ---

        System Prompt used for Chatbot1:
        ---
        ${finalSystemPrompt}
        ---

        Survey Design generated by Chatbot1:
        ---
        ${initialSurveyDesign}
        ---
        Your review:
      `;
      const messagesToChatbot2 = [{ role: "user", content: reviewPrompt }];
      const response2 = await callOpenAIChat(chatbot2Model, messagesToChatbot2);
      const reviewFromChatbot2 = response2.choices[0].message.content || "No review feedback provided.";

      // 3. Chatbot1 revises the survey design
      const revisionPrompt = `
        You are an AI assistant that generated the initial survey design below.
        Another AI (Chatbot2) has reviewed your design and provided feedback.
        Please carefully consider the feedback and revise your original survey design.
        Ensure the revised design still accurately addresses the original user prompt and adheres to ALL requirements in the original system prompt.
        Return the complete, revised survey design.

        Original User Prompt:
        ---
        ${userQuery}
        ---

        Original System Prompt You Followed:
        ---
        ${finalSystemPrompt}
        ---

        Your Initial Survey Design:
        ---
        ${initialSurveyDesign}
        ---

        Chatbot2's Review of Your Design:
        ---
        ${reviewFromChatbot2}
        ---

        Your Revised Survey Design:
      `;
      const messagesToChatbot1Revision = [
        systemMessage,
        { role: "user", content: revisionPrompt }
      ];
      const response3 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Revision);
      const revisedSurveyDesign = response3.choices[0].message.content || initialSurveyDesign; // Fallback to initial if revision fails

      finalApiResponse = {
        message: revisedSurveyDesign,
        // Add a note about the review process if desired, or just return the final design.
        // For example: `// Survey design revised based on review.\n${revisedSurveyDesign}`
      };

    } else {
      // Original Flow (No Code Review)
      const { model, canUseApi, remainingRequests: modelSelectionRemaining } = await getModelForUser(clerkUser.id);
    
      if (!canUseApi) {
        return NextResponse.json({ 
          error: "Monthly API request limit reached. Please upgrade your plan for more requests.", 
          limitReached: true 
        }, { status: 403 });
      }
      
      const messagesToAI = [systemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(model, messagesToAI);
      
      finalApiResponse = {
        message: response.choices[0].message.content || "Could not generate a response.",
        remainingRequests: modelSelectionRemaining 
      };
    }

    await incrementApiUsage(clerkUser.id);
    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    const remainingRequestsAfterIncrement = Math.max(0, (usageData?.monthlyLimit || 0) - (usageData?.usageCount || 0));
    finalApiResponse.remainingRequests = remainingRequestsAfterIncrement;
    
    return NextResponse.json(finalApiResponse);

  } catch (error: any) {
    console.error("Error in Collect chat:", error);
    let errorDetails = error.message;
    if (error.response && error.response.data && error.response.data.error) {
        errorDetails = error.response.data.error.message || error.message;
    }
    return NextResponse.json(
      { error: "Failed to generate survey suggestion", details: errorDetails, stack: error.stack },
      { status: 500 }
    );
  }
}