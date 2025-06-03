import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage } from "@/lib/modelSelection";
import { fetchRelevantData, DATA_TYPES } from "./datalabHelper";
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

const FALLBACK_DATALAB_SYSTEM_PROMPT_TEMPLATE = `
You are an AI assistant specialized in creating D3.js visualizations...
Return ONLY the JavaScript code for the D3.js visualization. Do not include explanations unless specifically asked.
`; // (Keep existing template content)

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
        customSystemPrompt, 
        selectedDataTypes, 
        useCodeReview, 
        selectedCoderModelId, // New
        selectedReviewerModelId // New
    } = await request.json();

    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;

    const querySpecificDataContext = await fetchRelevantData(userQuery, clerkUser.id, selectedDataTypes);
    const querySpecificContextKeys = Object.keys(querySpecificDataContext);
    const sandboxErrorNoteForPrompt = querySpecificDataContext.sandboxFetchError ? `Note: Sandbox data error: ${querySpecificDataContext.sandboxFetchError}` : '';

    let finalSystemPrompt: string;
    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      finalSystemPrompt = customSystemPrompt
        .replace('%%DATALAB_QUERY_SPECIFIC_DATACONTEXT_KEYS%%', JSON.stringify(querySpecificContextKeys))
        .replace('%%DATALAB_SANDBOX_FETCH_ERROR_NOTE%%', sandboxErrorNoteForPrompt);
      if (finalSystemPrompt.includes('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%') || finalSystemPrompt.includes('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%')) {
        const generalContext = await fetchRelevantData("general overview", clerkUser.id, Object.values(DATA_TYPES));
        finalSystemPrompt = finalSystemPrompt
          .replace('%%DATALAB_AVAILABLE_DATA_CATEGORIES%%', JSON.stringify(Object.values(DATA_TYPES)))
          .replace('%%DATALAB_GENERAL_SCHEMA_OVERVIEW%%', JSON.stringify(Object.keys(generalContext)));
      }
    } else {
      const generalContextForFallback = await fetchRelevantData("general overview", clerkUser.id, Object.values(DATA_TYPES));
      finalSystemPrompt = FALLBACK_DATALAB_SYSTEM_PROMPT_TEMPLATE
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
        limitReached: true,
        dataContext: querySpecificDataContext
      }, { status: 403 });
    }
    if (modelResolution.error) {
        return NextResponse.json({ error: modelResolution.error, dataContext: querySpecificDataContext }, { status: 400 });
    }

    if (useCodeReview) {
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        console.error("DataLab API: Code review models not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve models for code review.", dataContext: querySpecificDataContext }, { status: 500 });
      }
      const chatbot1Model = modelResolution.chatbot1Model;
      const chatbot2Model = modelResolution.chatbot2Model;

      const createReviewerPrompt = (initialGenerationContent: string | null): string => { return `You are an expert code reviewer... Original User Prompt... System Prompt... Code generated by Chatbot1:\n---\n\`\`\`javascript\n${extractCodeFromResponse(initialGenerationContent).code || "Chatbot1 did not produce reviewable code."}\n\`\`\`\n---\nYour review:`; };
      const createRevisionPrompt = (initialGenerationContent: string | null, reviewFromChatbot2: string | null): string => { return `You are an AI assistant that generated D3.js code... Original User Prompt... System Prompt... Your Initial D3.js Code:\n---\n\`\`\`javascript\n${extractCodeFromResponse(initialGenerationContent).code || "No initial code."}\n\`\`\`\n---\nChatbot2's Review:\n---\n${reviewFromChatbot2 || "No review."}\n---\nYour Revised D3.js Code (only the JavaScript code block):`; };
      
      const reviewCycleOutputs: AiReviewCycleRawOutputs = await performAiReviewCycle(
        chatbot1Model, systemMessage, initialUserMessages, chatbot2Model, createReviewerPrompt, createRevisionPrompt
      );
      
      const { code: initialCode, message_text: initialMessageText } = extractCodeFromResponse(reviewCycleOutputs.chatbot1InitialResponse.content);
      const { code: revisedCode, message_text: revisedMessageText } = extractCodeFromResponse(reviewCycleOutputs.chatbot1RevisionResponse.content, "Code revised by Chatbot1.");

      if (!initialCode.trim() && !revisedCode.trim()) {
         finalApiResponse = {
            message: `Chatbot1 (Model: ${chatbot1Model}) did not produce code. Initial: ${initialMessageText || reviewCycleOutputs.chatbot1InitialResponse.content}. Revision attempt also failed.`,
            code: "",
        };
      } else {
        finalApiResponse = {
          message: `Code generated with review. Initial: "${initialMessageText}". Review: "${reviewCycleOutputs.chatbot2ReviewResponse.content || "No review"}". Final: "${revisedMessageText}"`,
          code: revisedCode || initialCode,
        };
      }
    } else {
      if (!modelResolution.chatbot1Model) {
        console.error("DataLab API: Primary model not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve model.", dataContext: querySpecificDataContext }, { status: 500 });
      }
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [systemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      const aiResponseContent = response.choices[0].message.content;
      const { code, message_text } = extractCodeFromResponse(aiResponseContent, "Generated D3.js visualization code.");
      finalApiResponse = { message: message_text, code: code };
    }

    finalApiResponse.dataContext = querySpecificDataContext;
    finalApiResponse.remainingRequests = modelResolution.remainingRequests;
    
    await incrementApiUsage(clerkUser.id);
    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    finalApiResponse.remainingRequests = Math.max(0, (usageData?.monthlyLimit || 0) - (usageData?.usageCount || 0));

    return NextResponse.json(finalApiResponse);

  } catch (error: any) {
    console.error("Error in DataLab chat:", error);
    return NextResponse.json(
      { error: "Failed to generate visualization", details: error.message, stack: error.stack }, { status: 500 }
    );
  }
}