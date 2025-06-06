import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { getTemplateStructure, fetchGameCodeExamplesForQuery } from "./gamelabHelper";
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

// UPDATED EXAMPLE: A full, portable component with imports/exports
const reactTsxExample = `
import React, { useState, useEffect } from 'react';

// It's good practice to define styles as a separate const for readability.
const styles = \`
  .container { 
    font-family: Arial, sans-serif; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    justify-content: center; 
    min-height: 80vh; 
    background-color: #f0f8ff; 
    padding: 20px; 
    border-radius: 10px; 
  }
  .title { color: #333; }
  .button { 
    background-color: #10B981; 
    color: white; padding: 10px 15px; 
    border: none; 
    border-radius: 5px; 
    cursor: pointer; 
    font-size: 16px; 
  }
  .button:hover { background-color: #059669; }
  .gameArea { 
    width: 300px; 
    height: 200px; 
    border: 1px solid #ccc; 
    margin-top: 20px; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
  }
\`;

const App: React.FC = () => {
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (typeof window.sendDataToGameLab === 'function') {
      window.sendDataToGameLab({ event: 'game_started', time: new Date().toISOString() });
    }
  }, []);

  const handlePlayerAction = () => {
    const newScore = score + 10;
    setScore(newScore);
    if (typeof window.sendDataToGameLab === 'function') {
      window.sendDataToGameLab({ event: 'player_action', newScore });
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="container">
        <h1 className="title">My Awesome React Game</h1>
        <p>Score: {score}</p>
        <button onClick={handlePlayerAction} className="button">Perform Action</button>
        <div className="gameArea"><p>Game Content Here</p></div>
      </div>
    </>
  );
};

export default App;
`;

// UPDATED PROMPT
const FALLBACK_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI game development assistant for RandomPlayables. Your primary goal is to generate a complete, portable, and runnable React/TSX game component.

Key Instructions:
1.  **Generate Full Component:** Create a self-contained TSX file. You **MUST** include necessary imports (e.g., \`import React, { useState } from 'react';\`) and **MUST** export the main component as a default export (\`export default App;\`).
2.  **Main Component:** The main component MUST be a React Functional Component named \`App\`.
3.  **Attribute Values:** **CRITICAL RULE:** All HTML attributes must be string literals. For example, use \`type="text"\`, \`className="my-class"\`. NEVER use variable names for static attributes like \`type={number}\`; this will cause an error.
4.  **Styling:** Include CSS styles inside a \`<style>\` tag within the component's returned JSX for easy portability.
5.  **Sandbox Interaction:** The generated code will be adapted for a sandbox. If you need to send data out, a global function \`window.sendDataToGameLab(data)\` will be available. Check for its existence before using it: \`if (typeof window.sendDataToGameLab === 'function') { ... }\`.
6.  **No Sandbox-Specific Code:** Do not add code that is specific to the sandbox environment (like \`window.App = App;\`). The build process handles that. Just write a standard, portable React component.

Available Game Code Examples (for context):
%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%

Available GameLab Template Structures:
%%GAMELAB_TEMPLATE_STRUCTURES%%

Return ONLY the code required.
EXAMPLE OF A CORRECTLY FORMATTED REACT + TYPESCRIPT SKETCH:
\`\`\`tsx
${reactTsxExample}
\`\`\`
`;

// This prompt remains largely the same but is still relevant for the review process.
const FALLBACK_GAMELAB_REVIEWER_SYSTEM_PROMPT = `
You are an AI expert reviewing game code for a browser sandbox environment.
Focus your review on:
1.  **Sandbox Compatibility:** The code will be sanitized (imports/exports removed) before hitting the sandbox. Review the source code for correctness assuming React is available. Does it correctly access React hooks (e.g., \`useState\`)? Is the main \`App\` component correctly defined?
2.  **Correctness & Functionality:** Does the code run? Does it function as described?
3.  **Code Quality:** Is the code well-structured and readable?
4.  **Adherence to Requirements:** Is the main component named \`App\`? Is \`window.sendDataToGameLab\` checked with \`typeof window.sendDataToGameLab === 'function'\` before use?
5.  **Completeness:** Is the code a complete, runnable example?
Provide specific, constructive feedback. Return only your review.
`;

// UPDATED Sanitize Function
function sanitizeCodeForBrowser(code: string, language: string): string {
  if (language !== 'tsx' && language !== 'jsx' && language !== 'react') {
    return code;
  }
  let sanitizedCode = code;

  // Remove all import statements
  sanitizedCode = sanitizedCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '');

  // Remove export statements
  sanitizedCode = sanitizedCode.replace(/export\s+default\s+App;/g, '');
  sanitizedCode = sanitizedCode.replace(/export\s+(const|let|var|function|class)/g, '$1');

  // Add the window.App assignment for the sandbox.
  if (!/window\.App\s*=\s*App;/.test(sanitizedCode)) {
    sanitizedCode += '\n\nwindow.App = App;';
  }

  // Add React hook destructuring inside the App component if it's not there.
  const appComponentRegex = /(const\s+App[^=]*=>\s*{)/;
  if (appComponentRegex.test(sanitizedCode) && !/const\s*\{\s*useState\s*,/.test(sanitizedCode)) {
    sanitizedCode = sanitizedCode.replace(appComponentRegex, '$1\n  const { useState, useEffect, useCallback, useRef } = React;');
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
      const tsxBlock = codeBlocks.find(block => ['tsx', 'typescript', 'jsx', 'javascript', 'react'].includes(block[1].toLowerCase()));
      const htmlBlock = codeBlocks.find(block => block[1].toLowerCase() === 'html');
      let mainCodeBlock: [string, string, string] | undefined = tsxBlock || htmlBlock || codeBlocks[0];
      language = mainCodeBlock[1].toLowerCase() || defaultLanguage;
      if (['typescript', 'javascript', 'react'].includes(language) && !mainCodeBlock[2].includes("<!DOCTYPE html>")) language = 'tsx';
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

    const { message: userQuery, chatHistory, coderSystemPrompt, reviewerSystemPrompt, useCodeReview, selectedCoderModelId, selectedReviewerModelId } = await request.json();
    const profile = await prisma.profile.findUnique({ where: { userId: clerkUser.id }, select: { subscriptionActive: true, subscriptionTier: true } });
    const isSubscribed = !!profile?.subscriptionActive;
    
    // Construct System Prompts
    const templateStructure = getTemplateStructure();
    const querySpecificGameCodeExamples = await fetchGameCodeExamplesForQuery(userQuery);
    const gameCodeExamplesString = Object.keys(querySpecificGameCodeExamples).length > 0 
        ? `Context from existing game code: ${JSON.stringify(querySpecificGameCodeExamples, null, 2)}`
        : "No specific game code examples found.";

    const baseCoderPrompt = (coderSystemPrompt && coderSystemPrompt.trim() !== "") ? coderSystemPrompt : FALLBACK_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE;
    const coderSystemPromptToUse = baseCoderPrompt
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2))
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
    
    let finalApiResponse: { message: string; originalCode?: string; code?: string; language?: string; remainingRequests?: number; error?: string; limitReached?: boolean };
    const initialUserMessages: ChatCompletionMessageParam[] = [...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]), { role: "user", content: userQuery }];
    const coderSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: coderSystemPromptToUse };
    
    const modelResolution = await resolveModelsForChat(clerkUser.id, isSubscribed, useCodeReview, selectedCoderModelId, selectedReviewerModelId);
    if (!modelResolution.canUseApi) return NextResponse.json({ error: modelResolution.error || "Monthly API limit reached.", limitReached: true }, { status: 403 });
    if (modelResolution.error) return NextResponse.json({ error: modelResolution.error }, { status: 400 });

    let portableCode = '';
    let finalLanguage = 'tsx';
    let responseMessage = '';

    if (useCodeReview) {
      // Logic for code review... (This logic will now work correctly with the new prompts)
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        return NextResponse.json({ error: "Failed to resolve models for code review." }, { status: 500 });
      }
      const baseReviewerPrompt = (reviewerSystemPrompt && reviewerSystemPrompt.trim() !== "") ? reviewerSystemPrompt : FALLBACK_GAMELAB_REVIEWER_SYSTEM_PROMPT;
      const reviewerSystemPromptToUse = baseReviewerPrompt
            .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2))
            .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
      const reviewerSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: reviewerSystemPromptToUse };
      
      const createReviewerPrompt = (initialGen: string | null) => `Review the following TSX component based on your instructions. Initial code:\n\n\`\`\`tsx\n${initialGen || 'No code generated.'}\n\`\`\``;
      const createRevisionPrompt = (initialGen: string | null, review: string | null) => `Revise your initial code based on the following review. Initial code:\n\n\`\`\`tsx\n${initialGen || 'No code.'}\n\`\`\`\n\nReview:\n${review || 'No review.'}\n\nReturn only the revised, complete TSX code.`;

      const reviewCycleOutputs = await performAiReviewCycle(modelResolution.chatbot1Model, coderSystemMessage, initialUserMessages, modelResolution.chatbot2Model, reviewerSystemMessage, createReviewerPrompt, createRevisionPrompt);
      const { code, language, message_text } = extractGameLabCodeFromResponse(reviewCycleOutputs.chatbot1RevisionResponse.content);
      portableCode = code;
      finalLanguage = language;
      responseMessage = `Code generated with AI review. Reviewer feedback: "${reviewCycleOutputs.chatbot2ReviewResponse.content || 'N/A'}". Final response: ${message_text}`;

    } else {
      if (!modelResolution.chatbot1Model) return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [coderSystemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      const { code, language, message_text } = extractGameLabCodeFromResponse(response.choices[0].message.content);
      portableCode = code;
      finalLanguage = language;
      responseMessage = message_text;
    }
    
    // Sanitize the code for the sandbox after getting the final version
    const sandboxCode = sanitizeCodeForBrowser(portableCode, finalLanguage);
    
    finalApiResponse = {
        message: responseMessage,
        originalCode: portableCode, // The real, portable code
        code: sandboxCode,          // The code for the sandbox preview
        language: finalLanguage,
    };

    // Increment usage and add remaining requests to response
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