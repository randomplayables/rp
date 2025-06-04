import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resolveModelsForChat, incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { getTemplateStructure, fetchGameCodeExamplesForQuery } from "./gamelabHelper";
import { callOpenAIChat, performAiReviewCycle, AiReviewCycleRawOutputs } from "@/lib/aiService";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

const reactTsxExample = `
// Example of a simple App.tsx component:
import React, { useState, useEffect } from 'react';

// Define a simple CSS style string or suggest a separate CSS file.
const appStyles = \`
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
  .title {
    color: #333;
  }
  .button {
    background-color: #10B981; /* emerald-500 */
    color: white;
    padding: 10px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
  }
  .button:hover {
    background-color: #059669; /* emerald-600 */
  }
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

// Main App component
const App: React.FC = () => {
  const [score, setScore] = useState<number>(0);

  useEffect(() => {
    console.log("GameLab React Sketch Initialized!");
    if (window.sendDataToGameLab) {
      window.sendDataToGameLab({ event: 'game_started', time: new Date().toISOString() });
    }
  }, []);

  const handlePlayerAction = () => {
    const newScore = score + 10;
    setScore(newScore);
    if (window.sendDataToGameLab) {
      window.sendDataToGameLab({ event: 'player_action', newScore, time: new Date().toISOString() });
    }
  };

  return (
    <>
      <style>{appStyles}</style>
      <div className="container">
        <h1 className="title">My Awesome React Game</h1>
        <p>Score: {score}</p>
        <button onClick={handlePlayerAction} className="button">
          Perform Action
        </button>
        <div className="gameArea">
          <p>Game Content Here</p>
        </div>
      </div>
    </>
  );
};
// Ensure App is available for GameSandbox to render
// export default App; // Or ensure GameSandbox renders it correctly if not default exported
`;

const FALLBACK_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE = `
You are an AI game development assistant for RandomPlayables. Your primary goal is to generate self-contained, runnable game code based on user requests, suitable for the GameLab sandbox environment.

Key Instructions:
1.  **Output Format:** Primarily, you should generate code for a single \`App.tsx\` file (React with TypeScript). This component will be rendered in the GameLab sandbox.
    Alternatively, for very simple games or if the user specifically requests it, you can provide a single HTML file with embedded JavaScript and CSS.
2.  **React/TSX Sketches (\`App.tsx\`):**
    * The main React component MUST be named \`App\`.
    * Use functional components with hooks (e.g., \`useState\`, \`useEffect\`).
    * Include basic inline CSS via a \`<style>\` tag within the TSX, or define styles as JavaScript objects if simple enough. Avoid complex CSS setups for sketches.
    * Ensure the sketch is self-contained within this single \`App.tsx\` structure.
    * **Sandbox Interaction:** If the game involves sending data (e.g., scores, events), use \`window.sendDataToGameLab({ your_data_here })\`. Check for its existence first: \`if (typeof window.sendDataToGameLab === 'function') { ... }\`.
    * The GameLab sandbox injects \`GAMELAB_SESSION_ID\` into the window scope. You can use this if needed: \`console.log("Session ID:", window.GAMELAB_SESSION_ID);\`.
3.  **HTML/JS/CSS Games:**
    * Provide a complete, single HTML file.
    * Embed JavaScript within \`<script>\` tags and CSS within \`<style>\` tags.
    * Keep it simple and self-contained.
4.  **Code Structure and Clarity:**
    * Write clean, readable, and well-commented code, especially for more complex logic.
    * For TSX, ensure proper typing.
5.  **User Prompts:** Interpret user requests for game ideas, mechanics, or themes, and translate them into a functional sketch.
6.  **Iterative Development:** If the user provides existing code or asks for modifications, work with that, adhering to the sandbox constraints.
7.  **Error Handling (Basic):** For sketches, include basic console logs for key events or errors to help with debugging in the sandbox.
8.  **No External Dependencies (unless explicitly part of a standard HTML/JS browser environment or React for TSX):** Do not assume external libraries are available unless they are standard browser APIs (like \`Math\`, \`Date\`) or React/ReactDOM for TSX.

Available Game Code Examples (for context, structure, or inspiration if relevant to the query):
%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%

Available GameLab Template Structures (primarily for React/TSX sketches):
%%GAMELAB_TEMPLATE_STRUCTURES%%

Focus on generating the code block directly. If explanations are needed, keep them brief and separate from the main code block.
If providing TSX, ensure the main component is \`App\`.
If providing HTML, ensure it's a full, runnable document.
Return ONLY the code required.
EXAMPLE OF A SIMPLE REACT + TYPESCRIPT GAME SKETCH COMPONENT (\`App.tsx\`):
\`\`\`tsx
${reactTsxExample}
\`\`\`
`;

const FALLBACK_GAMELAB_REVIEWER_SYSTEM_PROMPT = `
You are an AI expert in game development, specializing in simple browser-based games using HTML, CSS, and JavaScript, or React with TypeScript (TSX) for game sketches intended for a sandbox environment.
Your task is to review game code generated by another AI assistant. The initial AI was given a user's query and a system prompt.
Focus your review on:
1.  **Correctness & Functionality:** Does the code run? Does the game function as described or implied by the user's query? Are there obvious bugs?
2.  **Code Quality:** Is the code well-structured, readable, and maintainable? (For React/TSX: Are components well-defined? Is state management appropriate?)
3.  **Game Design Principles:** Is the game concept clear? Is there a basic objective or interaction? Is it potentially engaging for a simple sketch?
4.  **Adherence to Requirements:** (If React/TSX sketch for GameLab Sandbox) Is the main component named \`App\`? Does it seem compatible with a sandbox environment that might inject functions like \`window.sendDataToGameLab\`?
5.  **Completeness:** Does the code provide a complete, runnable example, or are critical parts missing?
6.  **Security & Performance (Basic):** Are there any obvious, glaring security issues or performance bottlenecks for a simple browser game?

Provide constructive feedback. Be specific. If you identify issues or areas for improvement, explain them and suggest concrete changes or fixes. Remember the context is often for quick sketches or simple games.
Return only your review of the game code.
`;


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
      if (language === 'html' && mainCodeBlock[2].includes('<script type="text/babel">')) language = 'tsx'; // Treat Babel HTML as TSX for sandbox
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
        coderSystemPrompt, // Renamed
        reviewerSystemPrompt, // New
        useCodeReview, 
        selectedCoderModelId, 
        selectedReviewerModelId 
    } = await request.json();

    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true, subscriptionTier: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;

    const templateStructure = getTemplateStructure();
    const querySpecificGameCodeExamples = await fetchGameCodeExamplesForQuery(userQuery); // This is light, just names/IDs
    const gameCodeExamplesString = Object.keys(querySpecificGameCodeExamples).length > 0 
        ? `Found examples related to: ${Object.keys(querySpecificGameCodeExamples).join(', ')}. The AI can access their full code if it deems them relevant.` 
        : "No specific game code examples directly match the query keywords in the database.";

    let coderSystemPromptToUse: string;
    if (coderSystemPrompt && coderSystemPrompt.trim() !== "") {
      coderSystemPromptToUse = coderSystemPrompt.replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
      if (coderSystemPromptToUse.includes('%%GAMELAB_TEMPLATE_STRUCTURES%%')) {
        coderSystemPromptToUse = coderSystemPromptToUse.replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2));
      }
    } else {
      coderSystemPromptToUse = FALLBACK_GAMELAB_CODER_SYSTEM_PROMPT_TEMPLATE
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2))
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
    }

    let reviewerSystemPromptToUse: string | null = null;
    if (useCodeReview) {
        let prompt: string;
        
        if (reviewerSystemPrompt && reviewerSystemPrompt.trim() !== "") {
            prompt = reviewerSystemPrompt
              .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
              
            if (prompt.includes('%%GAMELAB_TEMPLATE_STRUCTURES%%')) {
                prompt = prompt.replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2));
            }
        } else {
            prompt = FALLBACK_GAMELAB_REVIEWER_SYSTEM_PROMPT
                .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2))
                .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
        }
        
        reviewerSystemPromptToUse = prompt;
    }

    let finalApiResponse: { message: string; code?: string; language?: string; remainingRequests?: number; error?: string; limitReached?: boolean };

    const initialUserMessages: ChatCompletionMessageParam[] = [
        ...(chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })) as ChatCompletionMessageParam[]),
        { role: "user", content: userQuery }
    ];
    const coderSystemMessage: ChatCompletionSystemMessageParam = { role: "system", content: coderSystemPromptToUse };
    const reviewerSystemMessage: ChatCompletionSystemMessageParam | null = reviewerSystemPromptToUse ? { role: "system", content: reviewerSystemPromptToUse } : null;
        
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
      }, { status: modelResolution.limitReached ? 403 : 400 });
    }
    if (modelResolution.error) {
        return NextResponse.json({ error: modelResolution.error }, { status: 400 });
    }

    if (useCodeReview) {
      if (!modelResolution.chatbot1Model || !modelResolution.chatbot2Model) {
        console.error("GameLab API: Code review models not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve models for code review." }, { status: 500 });
      }
      const chatbot1ModelToUse = modelResolution.chatbot1Model;
      const chatbot2ModelToUse = modelResolution.chatbot2Model;
      
      // The user message to the reviewer includes the coder's system prompt for context
      const createReviewerPrompt = (initialGenContent: string | null): string => { 
        const { code: iCode, language: iLang } = extractGameLabCodeFromResponse(initialGenContent);
        return `
You are reviewing game code. Below is the original user request, the system prompt given to the AI that generated the code, and the code itself.
Your task is to provide a critical review based on the system prompt you (the reviewer) received separately.

Original User Request to Initial AI (Chatbot1):
---
${userQuery}
---
System Prompt used for Initial AI (Chatbot1):
---
${coderSystemPromptToUse}
---
Code generated by Initial AI (Chatbot1) (Language: ${iLang}):
---
\`\`\`${iLang}
${iCode || "Chatbot1 did not produce reviewable code."}
\`\`\`
---
Your review of the game code (focus on correctness, quality, game design, adherence to requirements, and completeness based on your reviewer system prompt):`;
      };
      
      // The user message to the coder for revision includes its original system prompt for context
      const createRevisionPrompt = (initialGenContent: string | null, reviewContent: string | null): string => {
        const { code: iCode, language: iLang } = extractGameLabCodeFromResponse(initialGenContent);
        return `
You are the AI assistant that generated game code. Your previous work was reviewed by another AI.
Based on the review, please revise your game code.

Original User Request:
---
${userQuery}
---
Original System Prompt You Followed:
---
${coderSystemPromptToUse}
---
Your Initial Code (Language: ${iLang}):
---
\`\`\`${iLang}
${iCode || "No initial code."}
\`\`\`
---
Review of Your Code (from Chatbot2):
---
${reviewContent || "No review feedback provided."}
---
Your Revised Code (only the code block, in the original language ${iLang}):`;
      };

      const reviewCycleOutputs: AiReviewCycleRawOutputs = await performAiReviewCycle(
        chatbot1ModelToUse, 
        coderSystemMessage, 
        initialUserMessages, 
        chatbot2ModelToUse, 
        reviewerSystemMessage,
        createReviewerPrompt, 
        createRevisionPrompt
      );
      const { code: initialCode, language: initialLanguage, message_text: initialMessageText } = extractGameLabCodeFromResponse(reviewCycleOutputs.chatbot1InitialResponse.content);
      const { code: revisedCode, language: revisedLanguage, message_text: revisedMessageText } = extractGameLabCodeFromResponse(reviewCycleOutputs.chatbot1RevisionResponse.content, initialLanguage);

      if (!initialCode.trim() && !revisedCode.trim()) {
         finalApiResponse = { 
             message: `Chatbot1 (Model: ${chatbot1ModelToUse}) did not produce code. Initial response: "${initialMessageText}". Revision also failed. Reviewer (Model: ${chatbot2ModelToUse}) said: ${reviewCycleOutputs.chatbot2ReviewResponse.content || "No review content."}`, 
             code: "", 
             language: initialLanguage 
            };
      } else {
        finalApiResponse = {
          message: `Code generated with review. Initial response: "${initialMessageText}". Reviewer (Model: ${chatbot2ModelToUse}) said: "${reviewCycleOutputs.chatbot2ReviewResponse.content || "No review content."}". Final AI response: "${revisedMessageText}"`,
          code: revisedCode || initialCode, language: revisedLanguage || initialLanguage,
        };
      }
    } else {
      if (!modelResolution.chatbot1Model) {
        console.error("GameLab API: Primary model not resolved properly for user", clerkUser.id);
        return NextResponse.json({ error: "Failed to resolve model." }, { status: 500 });
      }
      const modelToUse = modelResolution.chatbot1Model;
      const messagesToAI: ChatCompletionMessageParam[] = [coderSystemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(modelToUse, messagesToAI);
      const { code, language, message_text } = extractGameLabCodeFromResponse(response.choices[0].message.content);
      finalApiResponse = { message: message_text, code, language };
    }
    
    const incrementParams: IncrementApiUsageParams = {
        userId: clerkUser.id,
        isSubscribed: isSubscribed,
        useCodeReview: useCodeReview,
        coderModelId: modelResolution.chatbot1Model,
        reviewerModelId: useCodeReview ? modelResolution.chatbot2Model : null
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