import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection"; // Updated import
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

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

async function fetchActiveGamesList() {
  await connectToDatabase();
  const games = await GameModel.find({}, {
    id: 1, name: 1, description: 1, _id: 0
  }).limit(10).lean();
  return games;
}

// Helper to get monthly limit, assuming it might be needed for initial remainingRequests display
// Or rely on the one in modelSelection.ts if only used there.
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
        customSystemPrompt, 
        useCodeReview, 
        selectedCoderModelId, 
        selectedReviewerModelId 
    } = await request.json();

    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true, subscriptionTier: true }, // Fetch tier for accurate limit display
    });
    const isSubscribed = profile?.subscriptionActive || false;

    let finalSystemPrompt: string;
    const games = await fetchActiveGamesList();
    const gamesListString = JSON.stringify(games, null, 2);

    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      finalSystemPrompt = customSystemPrompt;
      if (finalSystemPrompt.includes("%%AVAILABLE_GAMES_LIST%%")) {
        finalSystemPrompt = finalSystemPrompt.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
      }
    } else {
      finalSystemPrompt = FALLBACK_SYSTEM_PROMPT_TEMPLATE.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
    }

    let finalApiResponse: { message: string; remainingRequests?: number; error?: string; limitReached?: boolean };

    const initialUserMessages: ChatCompletionMessageParam[] = [
        ...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]),
        { role: "user", content: userQuery }
    ];
    const systemMessage: ChatCompletionSystemMessageParam = { role: "system", content: finalSystemPrompt };

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
        limitReached: true
      }, { status: modelResolution.limitReached ? 403 : 400 }); // Use 403 for limit reached
    }
     if (modelResolution.error) { // General errors from modelResolution
        return NextResponse.json({ error: modelResolution.error }, { status: 400 });
    }

    if (useCodeReview) {
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        console.error("Collect API: Code review models not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve models for code review." }, { status: 500 });
      }
      const chatbot1ModelToUse = modelResolution.chatbot1Model;
      const chatbot2ModelToUse = modelResolution.chatbot2Model;

      const createReviewerPrompt = (initialSurveyDesign: string | null): string => `
        You are an expert survey design reviewer...
        Original User Prompt to Chatbot1:\n---\n${userQuery}\n---\nSystem Prompt used for Chatbot1:\n---\n${finalSystemPrompt}\n---\nSurvey Design generated by Chatbot1:\n---\n${initialSurveyDesign || "Chatbot1 did not provide an initial survey design."}\n---\nYour review:`;
      const createRevisionPrompt = (initialSurveyDesign: string | null, reviewFromChatbot2: string | null): string => `
        You are an AI assistant that generated the initial survey design below...
        Original User Prompt:\n---\n${userQuery}\n---\nOriginal System Prompt You Followed:\n---\n${finalSystemPrompt}\n---\nYour Initial Survey Design:\n---\n${initialSurveyDesign || "No initial survey design was provided."}\n---\nChatbot2's Review of Your Design:\n---\n${reviewFromChatbot2 || "No review feedback provided."}\n---\nYour Revised Survey Design:`;

      const reviewCycleOutputs: AiReviewCycleRawOutputs = await performAiReviewCycle(
        chatbot1ModelToUse, systemMessage, initialUserMessages, chatbot2ModelToUse, createReviewerPrompt, createRevisionPrompt
      );
      finalApiResponse = { 
        message: reviewCycleOutputs.chatbot1RevisionResponse.content || reviewCycleOutputs.chatbot1InitialResponse.content || "Could not generate a revised response.",
        // remainingRequests will be updated after incrementing usage
      };
    } else {
      if (!modelResolution.chatbot1Model) {
        console.error("Collect API: Primary model not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
      }
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [systemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      finalApiResponse = { 
        message: response.choices[0].message.content || "Could not generate a response.",
        // remainingRequests will be updated after incrementing usage
      };
    }
    
    // *** NEW: Call incrementApiUsage with detailed parameters ***
    const incrementParams: IncrementApiUsageParams = {
        userId: clerkUser.id,
        isSubscribed: isSubscribed,
        useCodeReview: useCodeReview,
        coderModelId: modelResolution.chatbot1Model, 
        reviewerModelId: useCodeReview ? modelResolution.chatbot2Model : null
    };
    await incrementApiUsage(incrementParams);
    
    // Fetch updated usage for accurate remainingRequests
    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    if (usageData) {
        finalApiResponse.remainingRequests = Math.max(0, (usageData.monthlyLimit) - (usageData.usageCount));
    } else {
        // Fallback if usage record somehow isn't created by incrementApiUsage (should be rare)
        const limitForUser = getMonthlyLimitForTier(profile?.subscriptionTier);
        finalApiResponse.remainingRequests = limitForUser; // Assumes 0 usage if no record
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