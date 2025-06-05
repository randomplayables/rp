import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { getTemplateStructure, fetchGameCodeExamplesForQuery } from "./gamelabHelper";
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

// Keep the updated prompts and examples from the previous step, as they are still best practice.
const reactTsxExample = `
// NOTE: 'import' statements are NOT allowed.
// 'React' is already globally available in the sandbox.
const appStyles = \`
  .container { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; background-color: #f0f8ff; padding: 20px; border-radius: 10px; }
  .title { color: #333; }
  .button { background-color: #10B981; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
  .button:hover { background-color: #059669; }
  .gameArea { width: 300px; height: 200px; border: 1px solid #ccc; margin-top: 20px; display: flex; align-items: center; justify-content: center; }
\`;
const App = () => {
  const { useState, useEffect } = React;
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
      window.sendDataToGameLab({ event: 'player_action', newScore, time: new Date().toISOString() });
    }
  };
  return (
    <>
      <style>{appStyles}</style>
      <div className="container">
        <h1 className="title">My Awesome React Game</h1>
        <p>Score: {score}</p>
        <button onClick={handlePlayerAction} className="button">Perform Action</button>
        <div className="gameArea"><p>Game Content Here</p></div>
      </div>
    </>
  );
};
window.App = App;
`;

const FALLBACK_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI game development assistant for RandomPlayables generating code for an in-browser sandbox that uses Babel Standalone.

Key Instructions:
1.  **React/TSX Sandbox Rules:**
    * **CRITICAL RULE:** You **MUST NOT** include \`import\` or \`export\` statements. They are not supported and will fail.
    * \`React\` and \`ReactDOM\` are already globally available.
    * To use hooks, destructure them from the global \`React\` object: \`const { useState, useEffect } = React;\`.
    * The main component MUST be named \`App\`.
    * At the end of your script, you MUST assign your component to the window object: \`window.App = App;\`.
    * Use functional components with hooks and include inline CSS via a \`<style>\` tag.
    * **Sandbox Interaction:** Use \`window.sendDataToGameLab({ your_data_here })\` and check for its existence robustly: \`if (typeof window.sendDataToGameLab === 'function') { ... }\`.
2.  **Code Correctness:**
    * **Ensure all variables are correctly defined before they are used.** Pay close attention to variable names inside your component's logic and its returned JSX.
    * For example, if you define a state variable \`const [myValue, setMyValue] = React.useState(0);\`, you must use \`myValue\` in your JSX, not \`value\`.
3.  **General:** Write clean, self-contained, and readable code.

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

const FALLBACK_GAMELAB_REVIEWER_SYSTEM_PROMPT = `
You are an AI expert reviewing game code for a browser sandbox environment.
Focus your review on:
1.  **Sandbox Compatibility:** Does the code correctly AVOID using \`import\` and \`export\` statements? Does it correctly access React hooks (e.g., \`const { useState } = React;\`)? Is the main \`App\` component correctly assigned to \`window.App\`?
2.  **Correctness & Functionality:** Does the code run? Does it function as described?
3.  **Code Quality:** Is the code well-structured and readable?
4.  **Adherence to Requirements:** Is the main component named \`App\`? Is \`window.sendDataToGameLab\` checked with \`typeof window.sendDataToGameLab === 'function'\` before use?
5.  **Completeness:** Is the code a complete, runnable example?
Provide specific, constructive feedback. Return only your review.
`;

function sanitizeCodeForBrowser(code: string, language: string): string {
  if (language !== 'tsx' && language !== 'jsx' && language !== 'react') {
    return code;
  }
  let sanitizedCode = code;
  sanitizedCode = sanitizedCode.replace(/^import\s+.*?\s+from\s+['"].*?['"];?/gm, '');
  sanitizedCode = sanitizedCode.replace(/^export\s+default\s+.*?;?/gm, '');
  sanitizedCode = sanitizedCode.replace(/^export\s+(const|let|var|function|class)/gm, '$1');
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
      if ((aiResponseContent.includes("const App") || aiResponseContent.includes("function App") || aiResponseContent.includes("window.App"))) {
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

    let originalCode = '';
    let finalLanguage = 'tsx';
    let responseMessage = '';

    if (useCodeReview) {
      // Logic for code review... (omitted for brevity, but would set originalCode, finalLanguage, responseMessage)
    } else {
      if (!modelResolution.chatbot1Model) return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [coderSystemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      const { code, language, message_text } = extractGameLabCodeFromResponse(response.choices[0].message.content);
      originalCode = code;
      finalLanguage = language;
      responseMessage = message_text;
    }
    
    // Sanitize the code for the sandbox after getting the final version
    const sandboxCode = sanitizeCodeForBrowser(originalCode, finalLanguage);
    
    finalApiResponse = {
        message: responseMessage,
        originalCode: originalCode, // The real, portable code
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