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

function extractGameLabCodeFromResponse(
    aiResponseContent: string | null,
    languageHint: string
  ): { files?: Record<string, string>; code?: string; language: string; message_text: string } {
    if (!aiResponseContent) {
      return { language: languageHint, message_text: "No content from AI." };
    }
  
    let message_text = aiResponseContent;
  
    // TSX: Multi-file logic
    if (languageHint === 'tsx') {
      const files: Record<string, string> = {};
      const codeBlockRegex = /```\w*:(\/[\S]+)\n([\s\S]*?)```/g;
      let match;
  
      while ((match = codeBlockRegex.exec(aiResponseContent)) !== null) {
        const filePath = match[1].trim();
        const codeContent = match[2].trim();
        files[filePath] = codeContent;
        message_text = message_text.replace(match[0], "").trim();
      }
  
      if (Object.keys(files).length > 0) {
        return {
          files,
          language: 'tsx',
          message_text: message_text || "Multi-file code generated successfully."
        };
      }
    }
  
    // JS (and fallback for TSX if no multi-file format found): Single-file logic
    const singleFileRegex = /```(javascript|js|tsx|jsx|react)?\n([\s\S]*?)```/;
    const match = aiResponseContent.match(singleFileRegex);
  
    if (match && match[2]) {
      const code = match[2].trim();
      message_text = aiResponseContent.replace(match[0], "").trim();
      return {
        code,
        language: languageHint,
        message_text: message_text || "Code generated."
      };
    }
  
    // If no specific code block is found, but it looks like code, return it all
    if (languageHint === 'javascript' && !aiResponseContent.includes("```")) {
      return { code: aiResponseContent, language: 'javascript', message_text: "Generated JavaScript code." };
    }
  
    return { language: languageHint, message_text: aiResponseContent };
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const userQuery = formData.get('message') as string;
    const chatHistory = JSON.parse(formData.get('chatHistory') as string || '[]');
    const language = formData.get('language') as string;
    const coderSystemPrompt = formData.get('coderSystemPrompt') as string | null;
    const reviewerSystemPrompt = formData.get('reviewerSystemPrompt') as string | null;
    const useCodeReview = formData.get('useCodeReview') === 'true';
    const selectedCoderModelId = formData.get('selectedCoderModelId') as string | null;
    const selectedReviewerModelId = formData.get('selectedReviewerModelId') as string | null;
    const attachedAsset = formData.get('asset') as File | null;
    
    let assetContext = "No asset attached.";
    let dataUri = "";
    const assetPlaceholder = "%%ASSET_DATA_URI%%";

    if (attachedAsset) {
        const originalFilename = attachedAsset.name;
        const fileExtensionIndex = originalFilename.lastIndexOf('.');
        const baseFilename = fileExtensionIndex === -1 ? originalFilename : originalFilename.substring(0, fileExtensionIndex);
        const assetVarName = baseFilename.replace(/[^a-zA-Z0-9]/g, '_');

        const fileBuffer = await attachedAsset.arrayBuffer();
        const base64Content = Buffer.from(fileBuffer).toString('base64');
        dataUri = `data:${attachedAsset.type};base64,${base64Content}`;

        assetContext = `An asset named '${attachedAsset.name}' is attached. You MUST embed it directly in your React component by including this exact, unmodified line of code:
\`const ${assetVarName} = "${assetPlaceholder}";\`
Then, use this constant in an \`<img>\` tag's src attribute.
For example: \`<img src={${assetVarName}} alt="Uploaded asset" />\`.
Do NOT use a file import. Do NOT define the constant's value yourself; use the placeholder.`;
    }
    
    const profile = await prisma.profile.findUnique({ where: { userId: clerkUser.id }, select: { subscriptionActive: true, subscriptionTier: true } });
    const isSubscribed = !!profile?.subscriptionActive;
    
    const templateStructure = getTemplateStructure();
    const querySpecificGameCodeExamples = await fetchGameCodeExamplesForQuery(userQuery);
    const gameCodeExamplesString = Object.keys(querySpecificGameCodeExamples).length > 0 
        ? `Context from existing game code: ${JSON.stringify(querySpecificGameCodeExamples, null, 2)}`
        : "No specific game code examples found.";
    const templateStructuresString = JSON.stringify(templateStructure, null, 2);

    let baseCoderPrompt;
    if (language === 'javascript') {
        baseCoderPrompt = BASE_GAMELAB_CODER_SYSTEM_PROMPT_JS;
    } else {
        baseCoderPrompt = BASE_GAMELAB_CODER_SYSTEM_PROMPT_REACT;
    }
    
    let coderSystemPromptToUse = (coderSystemPrompt && coderSystemPrompt.trim() !== "") ? coderSystemPrompt : baseCoderPrompt;

    coderSystemPromptToUse = coderSystemPromptToUse
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', templateStructuresString)
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString)
        .replace('%%GAMELAB_ASSET_CONTEXT%%', assetContext);


    let finalAiResponseContent: string | null = null;
    const initialUserMessages: ChatCompletionMessageParam[] = [...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]), { role: "user", content: userQuery }];
    const coderSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: coderSystemPromptToUse };
    
    const modelResolution = await resolveModelsForChat(clerkUser.id, isSubscribed, useCodeReview, selectedCoderModelId, selectedReviewerModelId);
    if (!modelResolution.canUseApi) return NextResponse.json({ error: modelResolution.error || "Monthly API limit reached.", limitReached: true }, { status: 403 });
    if (modelResolution.error) return NextResponse.json({ error: modelResolution.error }, { status: 400 });

    if (useCodeReview) {
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        return NextResponse.json({ error: "Failed to resolve models for code review." }, { status: 500 });
      }
      const baseReviewerPrompt = (reviewerSystemPrompt && reviewerSystemPrompt.trim() !== "") ? reviewerSystemPrompt : BASE_GAMELAB_REVIEWER_SYSTEM_PROMPT;
      const reviewerSystemPromptToUse = baseReviewerPrompt;
      const reviewerSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: reviewerSystemPromptToUse };
      
      const createReviewerPrompt = (initialGen: string | null) => `Review the following code based on your instructions. Initial code:\n\n${initialGen || 'No code generated.'}`;
      const createRevisionPrompt = (initialGen: string | null, review: string | null) => `Revise your initial code based on the following review. Initial code:\n\n${initialGen || 'No code.'}\n\nReview:\n${review || 'No review.'}\n\nReturn only the revised, complete code.`;

      const reviewCycleOutputs = await performAiReviewCycle(modelResolution.chatbot1Model, coderSystemMessage, initialUserMessages, modelResolution.chatbot2Model, reviewerSystemMessage, createReviewerPrompt, createRevisionPrompt);
      finalAiResponseContent = reviewCycleOutputs.chatbot1RevisionResponse.content;

    } else {
      if (!modelResolution.chatbot1Model) return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [coderSystemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      finalAiResponseContent = response.choices[0].message.content;
    }
    
    // Inject the real Data URI if an asset was attached
    if (attachedAsset && finalAiResponseContent) {
        finalAiResponseContent = finalAiResponseContent.replace(`"${assetPlaceholder}"`, `"${dataUri}"`);
    }

    const extractionResult = extractGameLabCodeFromResponse(finalAiResponseContent, language);
    
    let finalApiResponse: {
        message: string;
        files?: Record<string, string>;
        originalCode?: string;
        code?: string;
        language?: string;
        remainingRequests?: number;
        error?: string;
        limitReached?: boolean;
      };

    if (language === 'tsx' && extractionResult.files && Object.keys(extractionResult.files).length > 0) {
        finalApiResponse = {
          message: extractionResult.message_text,
          files: extractionResult.files,
          language: 'tsx',
        };
    } else {
        const originalCode = extractionResult.code || '';
        const sandboxCode = language === 'javascript' ? originalCode : sanitizeCodeForBrowser(originalCode, extractionResult.language);
        finalApiResponse = {
          message: extractionResult.message_text,
          originalCode: originalCode,
          code: sandboxCode,
          language: extractionResult.language,
        };
    }

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