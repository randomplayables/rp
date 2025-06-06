import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { getTemplateStructure, fetchGameCodeExamplesForQuery } from "./gamelabHelper";
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";
import { 
  BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT, 
  BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS,
  BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT 
} from "@/app/gamelab/prompts";

function sanitizeCodeForBrowser(code: string, language: string): string {
  if (language !== 'tsx' && language !== 'jsx' && language !== 'react') {
    return code;
  }
  let sanitizedCode = code;

  sanitizedCode = sanitizedCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '');
  sanitizedCode = sanitizedCode.replace(/export\s+default\s+App;/g, '');
  sanitizedCode = sanitizedCode.replace(/export\s+(const|let|var|function|class)/g, '$1');

  if (!/window\.App\s*=\s*App;/.test(sanitizedCode)) {
    sanitizedCode += '\n\nwindow.App = App;';
  }

  const appComponentRegex = /(const\s+App[^=]*=>\s*{)|(function\s+App\s*\([^)]*\)\s*{)/;
  const hasHooks = /const\s*\{\s*useState\s*,|const\s*\{\s*useEffect\s*,/.test(sanitizedCode);

  if (appComponentRegex.test(sanitizedCode) && !hasHooks) {
    sanitizedCode = sanitizedCode.replace(appComponentRegex, (match) => `${match}\n  const { useState, useEffect, useCallback, useRef } = React;`);
  }

  return sanitizedCode.trim();
}

function getMonthlyLimitForTier(tier?: string | null): number {
    switch (tier) { case "premium": return 500; case "premium_plus": return 1500; default: return 100; }
}

function extractGameLabCodeFromResponse(aiResponseContent: string | null, defaultLanguage: string = "tsx"): { code: string; language: string; message_text: string } {
  if (!aiResponseContent) return { code: "", language: defaultLanguage, message_text: "No content from AI." };
  let code = ""; let language = defaultLanguage; let message_text = aiResponseContent;
  const codeBlockRegex = /```([a-zA-Z0-9+#-_]+)?\n([\s\S]*?)```/g;
  const codeBlocks: Array<[string, string, string]> = [];
  let match;
  while ((match = codeBlockRegex.exec(aiResponseContent)) !== null) codeBlocks.push([match[0], match[1] || '', match[2]]);
  if (codeBlocks.length > 0) {
      const tsxBlock = codeBlocks.find(block => ['tsx', 'typescript', 'jsx', 'react'].includes(block[1].toLowerCase()));
      const jsBlock = codeBlocks.find(block => block[1].toLowerCase() === 'javascript');
      const htmlBlock = codeBlocks.find(block => block[1].toLowerCase() === 'html');
      
      let mainCodeBlock: [string, string, string] | undefined = tsxBlock || jsBlock || htmlBlock || codeBlocks[0];
      
      language = mainCodeBlock[1].toLowerCase() || defaultLanguage;

      if (['typescript', 'react'].includes(language)) language = 'tsx';
      if (language === 'html' && mainCodeBlock[2].includes('<script type="text/babel">')) language = 'tsx';
      
      code = mainCodeBlock[2].trim();
      message_text = aiResponseContent.replace(mainCodeBlock[0], `\n[Code for ${language} generated]\n`).trim() || "Game code generated.";
  } else {
      if ((aiResponseContent.includes("const App") || aiResponseContent.includes("function App"))) {
          code = aiResponseContent; language = "tsx"; message_text = "Generated React/TypeScript component.";
      } else if (aiResponseContent.includes("<!DOCTYPE html>")) {
          code = aiResponseContent; language = "html"; message_text = "Generated HTML content.";
      } else { code = ""; message_text = aiResponseContent; }
  }
  return { code, language, message_text };
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { 
        message: userQuery, 
        chatHistory, 
        language,
        coderSystemPrompt, 
        reviewerSystemPrompt, 
        useCodeReview, 
        selectedCoderModelId, 
        selectedReviewerModelId 
    } = await request.json();
    
    const profile = await prisma.profile.findUnique({ where: { userId: clerkUser.id }, select: { subscriptionActive: true, subscriptionTier: true } });
    const isSubscribed = !!profile?.subscriptionActive;
    
    // --- RESTORED CONTEXT FETCHING ---
    const templateStructure = getTemplateStructure();
    const querySpecificGameCodeExamples = await fetchGameCodeExamplesForQuery(userQuery);
    const gameCodeExamplesString = Object.keys(querySpecificGameCodeExamples).length > 0 
        ? `Context from existing game code: ${JSON.stringify(querySpecificGameCodeExamples, null, 2)}`
        : "No specific game code examples found.";
    const templateStructuresString = JSON.stringify(templateStructure, null, 2);
    // --- END RESTORED CONTEXT FETCHING ---

    let baseCoderPrompt;
    if (language === 'javascript') {
        baseCoderPrompt = BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS;
    } else {
        baseCoderPrompt = BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT;
    }
    
    let coderSystemPromptToUse = (coderSystemPrompt && coderSystemPrompt.trim() !== "") ? coderSystemPrompt : baseCoderPrompt;

    // --- RESTORED PROMPT INJECTION ---
    coderSystemPromptToUse = coderSystemPromptToUse
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', templateStructuresString)
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
    // --- END RESTORED PROMPT INJECTION ---

    let finalApiResponse: { message: string; originalCode?: string; code?: string; language?: string; remainingRequests?: number; error?: string; limitReached?: boolean };
    const initialUserMessages: ChatCompletionMessageParam[] = [...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]), { role: "user", content: userQuery }];
    const coderSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: coderSystemPromptToUse };
    
    const modelResolution = await resolveModelsForChat(clerkUser.id, isSubscribed, useCodeReview, selectedCoderModelId, selectedReviewerModelId);
    if (!modelResolution.canUseApi) return NextResponse.json({ error: modelResolution.error || "Monthly API limit reached.", limitReached: true }, { status: 403 });
    if (modelResolution.error) return NextResponse.json({ error: modelResolution.error }, { status: 400 });

    let portableCode = '';
    let finalLanguage = language || 'tsx';
    let responseMessage = '';

    if (useCodeReview) {
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        return NextResponse.json({ error: "Failed to resolve models for code review." }, { status: 500 });
      }
      const baseReviewerPrompt = (reviewerSystemPrompt && reviewerSystemPrompt.trim() !== "") ? reviewerSystemPrompt : BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT;
      const reviewerSystemPromptToUse = baseReviewerPrompt;
      const reviewerSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: reviewerSystemPromptToUse };
      
      const createReviewerPrompt = (initialGen: string | null) => `Review the following code based on your instructions. Initial code:\n\n\`\`\`${language}\n${initialGen || 'No code generated.'}\n\`\`\``;
      const createRevisionPrompt = (initialGen: string | null, review: string | null) => `Revise your initial code based on the following review. Initial code:\n\n\`\`\`${language}\n${initialGen || 'No code.'}\n\`\`\`\n\nReview:\n${review || 'No review.'}\n\nReturn only the revised, complete code.`;

      const reviewCycleOutputs = await performAiReviewCycle(modelResolution.chatbot1Model, coderSystemMessage, initialUserMessages, modelResolution.chatbot2Model, reviewerSystemMessage, createReviewerPrompt, createRevisionPrompt);
      const { code, language: detectedLang, message_text } = extractGameLabCodeFromResponse(reviewCycleOutputs.chatbot1RevisionResponse.content, finalLanguage);
      portableCode = code;
      finalLanguage = detectedLang;
      responseMessage = `Code generated with AI review. Reviewer feedback: "${reviewCycleOutputs.chatbot2ReviewResponse.content || 'N/A'}". Final response: ${message_text}`;

    } else {
      if (!modelResolution.chatbot1Model) return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [coderSystemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      const { code, language: detectedLang, message_text } = extractGameLabCodeFromResponse(response.choices[0].message.content, finalLanguage);
      portableCode = code;
      finalLanguage = detectedLang;
      responseMessage = message_text;
    }
    
    const sandboxCode = sanitizeCodeForBrowser(portableCode, finalLanguage);
    
    finalApiResponse = {
        message: responseMessage,
        originalCode: portableCode,
        code: sandboxCode,
        language: finalLanguage,
    };

    const incrementParams: IncrementApiUsageParams = { userId: clerkUser.id, isSubscribed, useCodeReview, coderModelId: modelResolution.chatbot1Model, reviewerModelId: useCodeReview ? modelResolution.chatbot2Model : null };
    await incrementApiUsage(incrementParams);
    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    finalApiResponse.remainingRequests = usageData ? Math.max(0, usageData.monthlyLimit - usageData.usageCount) : getMonthlyLimitForTier(profile?.subscriptionTier);

    return NextResponse.json(finalApiResponse);

  } catch (error: any) {
    console.error("Error in GameLab chat:", error);
    return NextResponse.json({ error: "Failed to generate game code", details: error.message, stack: error.stack }, { status: 500 });
  }
}

declare global {
  interface Window {
    sendDataToGameLab?: (data: any) => void;
    GAMELAB_SESSION_ID?: string;
    App?: React.FC<any>;
  }
}