import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { callOpenAIChat } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

const FALLBACK_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI assistant specialized in creating custom surveys for the RandomPlayables platform.
You help users design effective surveys, questionnaires, and data collection tools that can
optionally incorporate interactive games.

When a user asks to integrate a game, you MUST use the exact 'gameId' from the list below and format the question as a numbered list item, like this: "1. Game Integration: your-game-id-here".

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
number them and specify the question type for each. For game integrations, use the required format: "X. Game Integration: gameId".
`;

async function fetchActiveGamesList() {
  await connectToDatabase();
  const games = await GameModel.find({}, {
    gameId: 1, name: 1, description: 1, _id: 0
  }).limit(20).lean();
  return games;
}

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

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { 
        message: userQuery, 
        chatHistory, 
        coderSystemPrompt, // Renamed from customSystemPrompt for clarity
        selectedCoderModelId, 
    } = await request.json();

    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true, subscriptionTier: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;

    const games = await fetchActiveGamesList();
    const gamesListString = JSON.stringify(games, null, 2);

    let coderSystemPromptToUse: string;
    if (coderSystemPrompt && coderSystemPrompt.trim() !== "") {
      coderSystemPromptToUse = coderSystemPrompt;
      if (coderSystemPromptToUse.includes("%%AVAILABLE_GAMES_LIST%%")) {
        coderSystemPromptToUse = coderSystemPromptToUse.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
      }
    } else {
      coderSystemPromptToUse = FALLBACK_COLLECT_CODER_SYSTEM_PROMPT_TEMPLATE.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
    }
    
    let finalApiResponse: { message: string; remainingRequests?: number; error?: string; limitReached?: boolean };

    const initialUserMessages: ChatCompletionMessageParam[] = [
        ...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]),
        { role: "user", content: userQuery }
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
        limitReached: true
      }, { status: modelResolution.limitReached ? 403 : 400 });
    }
     if (modelResolution.error) {
        return NextResponse.json({ error: modelResolution.error }, { status: 400 });
    }

    if (!modelResolution.chatbot1Model) {
      console.error("Collect API: Primary model not resolved properly for user", clerkUser.id);
      return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
    }
    const modelToUse = modelResolution.chatbot1Model;
    const messagesToAI: ChatCompletionMessageParam[] = [coderSystemMessage, ...initialUserMessages];
    const response = await callOpenAIChat(modelToUse, messagesToAI);
    finalApiResponse = { 
      message: response.choices[0].message.content || "Could not generate a response.",
    };
    
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