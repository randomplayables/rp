import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage } from "@/lib/modelSelection";
import { getTemplateStructure, fetchGameCodeExamplesForQuery } from "./gamelabHelper";
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

const reactTsxExample = `// Example of a simple App.tsx component...`; // Keep existing
const FALLBACK_GAMELAB_SYSTEM_PROMPT_TEMPLATE = `You are an AI game development assistant...`; // Keep existing

function extractGameLabCodeFromResponse(aiResponseContent: string | null, defaultLanguage: string = "tsx"): { code: string; language: string; message_text: string } {
  if (!aiResponseContent) return { code: "", language: defaultLanguage, message_text: "No content from AI." };
  let code = "";
  let language = defaultLanguage;
  let message_text = aiResponseContent;
  const codeBlockRegex = /```([a-zA-Z0-9+#-_]+)?\n([\s\S]*?)```/g;
  const codeBlocks: Array<[string, string, string]> = [];
  let match;
  while ((match = codeBlockRegex.exec(aiResponseContent)) !== null) codeBlocks.push([match[0], match[1] || '', match[2]]);
  if (codeBlocks.length > 0) {
      const tsxBlock = codeBlocks.find(block => ['tsx', 'typescript', 'jsx', 'javascript', 'react'].includes(block[1].toLowerCase()));
      const htmlBlock = codeBlocks.find(block => block[1].toLowerCase() === 'html');
      let mainCodeBlock: [string, string, string] | undefined = tsxBlock || htmlBlock || codeBlocks.reduce((longest, current) => current[2].length > longest[2].length ? current : longest, codeBlocks[0]);
      language = mainCodeBlock[1].toLowerCase() || defaultLanguage;
      if (['typescript', 'javascript', 'react'].includes(language) && !mainCodeBlock[2].includes("<!DOCTYPE html>")) language = 'tsx';
      if (language === 'html' && mainCodeBlock[2].includes('<script type="text/babel">')) language = 'tsx';
      code = mainCodeBlock[2].trim();
      message_text = aiResponseContent;
      for (const block of codeBlocks) message_text = message_text.replace(block[0], `\n[Code for ${block[1] || 'file'} generated]\n`);
      message_text = message_text.trim() || "Game code generated.";
  } else {
      if ((aiResponseContent.includes("React.FC") || aiResponseContent.includes("useState")) && (aiResponseContent.includes("const App") || aiResponseContent.includes("function App"))) {
          code = aiResponseContent; language = "tsx"; message_text = "Generated React/TypeScript component.";
      } else if (aiResponseContent.includes("<!DOCTYPE html>")) {
          code = aiResponseContent; language = "html"; message_text = "Generated HTML content.";
      } else if (aiResponseContent.length < 200 && !aiResponseContent.match(/<[^>]+>/) && !aiResponseContent.includes("import React")) {
          code = ""; message_text = aiResponseContent;
      } else {
          code = aiResponseContent; language = defaultLanguage; message_text = "AI response (code extraction might be imperfect).";
      }
  }
  return { code, language, message_text };
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
        selectedCoderModelId, // New
        selectedReviewerModelId // New
    } = await request.json();

    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;

    const templateStructure = getTemplateStructure();
    const querySpecificGameCodeExamples = await fetchGameCodeExamplesForQuery(userQuery);
    const gameCodeExamplesString = Object.keys(querySpecificGameCodeExamples).length > 0 ? JSON.stringify(querySpecificGameCodeExamples, null, 2) : "No specific game code examples match query.";

    let finalSystemPrompt: string;
    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      finalSystemPrompt = customSystemPrompt.replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
      if (finalSystemPrompt.includes('%%GAMELAB_TEMPLATE_STRUCTURES%%')) {
        finalSystemPrompt = finalSystemPrompt.replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2));
      }
    } else {
      finalSystemPrompt = FALLBACK_GAMELAB_SYSTEM_PROMPT_TEMPLATE
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2))
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
    }

    let finalApiResponse: { message: string; code?: string; language?: string; remainingRequests?: number; error?: string; limitReached?: boolean };

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
      }, { status: 403 });
    }
    if (modelResolution.error) {
        return NextResponse.json({ error: modelResolution.error }, { status: 400 });
    }

    if (useCodeReview) {
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        console.error("GameLab API: Code review models not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve models for code review." }, { status: 500 });
      }
      const chatbot1Model = modelResolution.chatbot1Model;
      const chatbot2Model = modelResolution.chatbot2Model;
      
      const createReviewerPrompt = (initialGenContent: string | null): string => { const { code: iCode, language: iLang } = extractGameLabCodeFromResponse(initialGenContent); return `You are an expert code reviewer... Original User Prompt... System Prompt... Code (Lang: ${iLang}):\n---\n\`\`\`${iLang}\n${iCode || "No code."}\n\`\`\`\n---\nYour review:`; };
      const createRevisionPrompt = (initialGenContent: string | null, reviewContent: string | null): string => { const { code: iCode, language: iLang } = extractGameLabCodeFromResponse(initialGenContent); return `You generated code... Original User Prompt... System Prompt... Your Initial Code (Lang: ${iLang}):\n---\n\`\`\`${iLang}\n${iCode || "No code."}\n\`\`\`\n---\nReview:\n---\n${reviewContent || "No review."}\n---\nRevised Code (only block in ${iLang}):`; };

      const reviewCycleOutputs: AiReviewCycleRawOutputs = await performAiReviewCycle(
        chatbot1Model, systemMessage, initialUserMessages, chatbot2Model, createReviewerPrompt, createRevisionPrompt
      );
      const { code: initialCode, language: initialLanguage, message_text: initialMessageText } = extractGameLabCodeFromResponse(reviewCycleOutputs.chatbot1InitialResponse.content);
      const { code: revisedCode, language: revisedLanguage, message_text: revisedMessageText } = extractGameLabCodeFromResponse(reviewCycleOutputs.chatbot1RevisionResponse.content, initialLanguage);

      if (!initialCode.trim() && !revisedCode.trim()) {
         finalApiResponse = { message: `Chatbot1 did not produce code...`, code: "", language: initialLanguage };
      } else {
        finalApiResponse = {
          message: `Code generated with review. Initial: "${initialMessageText}". Review: "${reviewCycleOutputs.chatbot2ReviewResponse.content || "No review"}". Final: "${revisedMessageText}"`,
          code: revisedCode || initialCode, language: revisedLanguage || initialLanguage,
        };
      }
    } else {
      if (!modelResolution.chatbot1Model) {
        console.error("GameLab API: Primary model not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
      }
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [systemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      const { code, language, message_text } = extractGameLabCodeFromResponse(response.choices[0].message.content);
      finalApiResponse = { message: message_text, code, language };
    }

    finalApiResponse.remainingRequests = modelResolution.remainingRequests;
    await incrementApiUsage(clerkUser.id);
    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    finalApiResponse.remainingRequests = Math.max(0, (usageData?.monthlyLimit || 0) - (usageData?.usageCount || 0));

    return NextResponse.json(finalApiResponse);

  } catch (error: any) {
    console.error("Error in GameLab chat:", error);
    return NextResponse.json(
      { error: "Failed to generate game code", details: error.message, stack: error.stack }, { status: 500 }
    );
  }
}

declare global {
  interface Window {
    sendDataToGameLab?: (data: any) => void;
    GAMELAB_SESSION_ID?: string;
  }
}