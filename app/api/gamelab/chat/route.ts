import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma"; // Import prisma
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";
import {
    getTemplateStructure,
    fetchGameCodeExamplesForQuery,
} from "./gamelabHelper";

// React + TypeScript example for the prompt (remains the same)
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
    // Example: Send data to GameLab sandbox if the function exists
    if (window.sendDataToGameLab) {
      window.sendDataToGameLab({ event: 'game_started', time: new Date().toISOString() });
    }
  }, []);

  const handlePlayerAction = () => {
    const newScore = score + 10;
    setScore(newScore);
    // Example: Send data on action
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

// The GameLab sandbox will attempt to render a component named 'App'.
// So, ensure 'App' is defined as above. For a standalone project, you'd also have:
// ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
// in a main.tsx file.
`;

// Fallback System Prompt Template (remains the same)
const FALLBACK_GAMELAB_SYSTEM_PROMPT_TEMPLATE = `
You are an AI game development assistant for RandomPlayables, a platform for mathematical citizen science games.
Your goal is to help users create games using React and TypeScript. These games can be simple sketches runnable in our GameLab sandbox or more complete projects ready for deployment on RandomPlayables.com.

IMPORTANT REQUIREMENTS FOR GAMES YOU CREATE:
1.  **Default to React and TypeScript**: All game logic and UI should be within React components (.tsx files).
2.  **Structure**:
    * **For simple sketches**: Provide the code for a primary React component (e.g., \`App.tsx\`). This component will be rendered in the GameLab sandbox. You can include CSS as a string within the TSX file or suggest it separately.
    * **For more complex/main games**: Outline a project structure (e.g., like a Vite + React + TS setup). Provide code for key files:
        * \`index.html\` (basic, with a div#root)
        * \`src/main.tsx\` (ReactDOM.createRoot and rendering App)
        * \`src/App.tsx\` (main game component)
        * A sample game component (e.g., \`src/components/GameBoard.tsx\`)
        * Basic \`package.json\` (with react, react-dom, vite, typescript) and \`tsconfig.json\`.
3.  **Styling**: Use inline styles, CSS modules, or a string of CSS content for sketches. For projects, standard CSS files are fine.
4.  **State Management**: Use React hooks (useState, useEffect, etc.) for state and side effects.
5.  **TypeScript**: Utilize TypeScript for type safety. Define interfaces for props and state.
6.  **Sandbox Compatibility (for sketches)**: The GameLab sandbox can render a React component named \`App\` from the provided TSX code. It uses Babel for in-browser transpilation. Ensure your sketch's \`App.tsx\` is self-contained or clearly states its dependencies if any (though prefer self-contained for sketches).
    The sandbox provides \`window.sendDataToGameLab(data: any)\` for the game to communicate back to the GameLab environment.
    The sandbox also makes \`window.GAMELAB_SESSION_ID\` available to the sketch.

AVAILABLE TEMPLATE STRUCTURES (Type A data, from GameLab helper):
%%GAMELAB_TEMPLATE_STRUCTURES%%

REAL CODE EXAMPLES FROM EXISTING GAMES (Type B data, based on your query):
%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%

When designing games based on existing code examples (if provided based on your query):
1. Follow similar patterns for game structure and organization using React and TypeScript.
2. Implement similar data structures for game state and scoring.

EXAMPLE OF A SIMPLE REACT + TYPESCRIPT GAME SKETCH COMPONENT (\`App.tsx\`):
\`\`\`tsx
${reactTsxExample}
\`\`\`

These games may be deployed on RandomPlayables.com, potentially as subdomains (e.g., gamename.randomplayables.com).

When responding:
1. Understand the user's game idea. Ask clarifying questions if needed.
2. Suggest a clear game structure and mechanics using React components and TypeScript.
3.  **For sketches**: Provide the complete code for the main \`App.tsx\` file.
4.  **For main games**: List each file (e.g., \`package.json\`, \`vite.config.ts\`, \`index.html\`, \`src/main.tsx\`, \`src/App.tsx\`, etc.) and provide its full content.
5. Explain any setup steps if a project structure is provided (e.g., \`npm install && npm run dev\`).
6. If the game is a sketch, ensure the main component is named \`App\`.
`;


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

// Helper function to extract code and language from GameLab AI response
function extractGameLabCodeFromResponse(aiResponseContent: string | null, defaultLanguage: string = "tsx"): { code: string; language: string; message_text: string } {
  if (!aiResponseContent) {
    return { code: "", language: defaultLanguage, message_text: "No content from AI." };
  }

  let code = "";
  let language = defaultLanguage;
  let message_text = aiResponseContent;

  const codeBlockRegex = /```([a-zA-Z0-9+#-_]+)?\n([\s\S]*?)```/g;
  const codeBlocks: Array<[string, string, string]> = []; // [fullMatch, lang, codeContent]
  let match;
  while ((match = codeBlockRegex.exec(aiResponseContent)) !== null) {
      codeBlocks.push([match[0], match[1] || '', match[2]]);
  }

  if (codeBlocks.length > 0) {
      const tsxBlock = codeBlocks.find(block => ['tsx', 'typescript', 'jsx', 'javascript', 'react'].includes(block[1].toLowerCase()));
      const htmlBlock = codeBlocks.find(block => block[1].toLowerCase() === 'html');
      
      let mainCodeBlock: [string, string, string] | undefined = tsxBlock || htmlBlock;

      if (!mainCodeBlock) {
        // If no specific tsx or html, pick the longest one
        mainCodeBlock = codeBlocks.reduce((longest, current) => current[2].length > longest[2].length ? current : longest, codeBlocks[0]);
      }
      
      language = mainCodeBlock[1].toLowerCase() || defaultLanguage;
      if (['typescript', 'javascript', 'react'].includes(language) && !code.includes("<!DOCTYPE html>")) language = 'tsx'; // Normalize to tsx for React components
      if (language === 'html' && mainCodeBlock[2].includes('<script type="text/babel">')) language = 'tsx';


      code = mainCodeBlock[2].trim();
      message_text = aiResponseContent;
      for (const block of codeBlocks) {
          // A more sophisticated removal might be needed if the AI includes text between code blocks
          message_text = message_text.replace(block[0], `\n[Code for ${block[1] || 'file'} was generated]\n`);
      }
      message_text = message_text.trim();
      if (!message_text) message_text = "Game code generated.";

  } else { 
      if ((aiResponseContent.includes("React.FC") || aiResponseContent.includes("useState") || aiResponseContent.includes("useEffect")) && (aiResponseContent.includes("const App") || aiResponseContent.includes("function App"))) {
          code = aiResponseContent;
          language = "tsx";
          message_text = "Generated React/TypeScript component:";
      } else if (aiResponseContent.includes("<!DOCTYPE html>")) {
          code = aiResponseContent;
          language = "html";
          message_text = "Generated HTML content:";
      } else if (aiResponseContent.length < 200 && !aiResponseContent.match(/<[^>]+>/) && !aiResponseContent.includes("import React")) { 
          code = ""; 
          message_text = aiResponseContent;
      } else { 
          code = aiResponseContent; // Fallback
          language = defaultLanguage; // Assume default
          message_text = "AI response (code extraction might be imperfect):";
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

    // MODIFIED: Include useCodeReview
    const { message: userQuery, chatHistory, customSystemPrompt, useCodeReview } = await request.json();
    
    const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionActive: true },
    });
    const isSubscribed = profile?.subscriptionActive || false;

    // --- Prepare System Prompt (common logic) ---
    const templateStructure = getTemplateStructure();
    const querySpecificGameCodeExamples = await fetchGameCodeExamplesForQuery(userQuery);
    const gameCodeExamplesString = Object.keys(querySpecificGameCodeExamples).length > 0
        ? JSON.stringify(querySpecificGameCodeExamples, null, 2)
        : "No specific game code examples match the query. Generic examples or templates may be used by the AI.";

    let finalSystemPrompt: string;
    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      finalSystemPrompt = customSystemPrompt.replace(
        '%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%',
        gameCodeExamplesString
      );
      if (finalSystemPrompt.includes('%%GAMELAB_TEMPLATE_STRUCTURES%%')) {
        console.warn("GameLab Chat API: Frontend-provided system prompt still contains %%GAMELAB_TEMPLATE_STRUCTURES%%. Resolving now.");
        finalSystemPrompt = finalSystemPrompt.replace(
          '%%GAMELAB_TEMPLATE_STRUCTURES%%',
          JSON.stringify(templateStructure, null, 2)
        );
      }
    } else {
      console.log("GameLab Chat API: No customSystemPrompt from frontend, using fallback.");
      finalSystemPrompt = FALLBACK_GAMELAB_SYSTEM_PROMPT_TEMPLATE
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2))
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
    }
    // --- End System Prompt Preparation ---

    let finalApiResponse: { message: string; code?: string; language?: string; remainingRequests?: number; };
    
    const initialUserMessages = [
        ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
        { role: "user", content: userQuery }
    ];
    const systemMessage = { role: "system", content: finalSystemPrompt };

    if (useCodeReview) {
      const chatbot1Model = isSubscribed ? "openai/o4-mini-high" : "meta-llama/llama-3.3-8b-instruct:free";
      const chatbot2Model = isSubscribed ? "google/gemini-2.5-flash-preview-05-20" : "deepseek/deepseek-r1-0528:free";

      // 1. Chatbot1 generates initial code
      const messagesToChatbot1Initial = [systemMessage, ...initialUserMessages];
      const response1 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Initial);
      const initialGenerationContent = response1.choices[0].message.content;
      const { code: initialCode, language: initialLanguage, message_text: initialMessageText } = extractGameLabCodeFromResponse(initialGenerationContent);

      if (!initialCode.trim()) {
        finalApiResponse = {
            message: `Chatbot1 (Model: ${chatbot1Model}) did not produce code in the first pass. Response: ${initialMessageText}`,
            code: "",
            language: initialLanguage,
        };
      } else {
        // 2. Chatbot2 reviews the code
        const reviewPrompt = `
          You are an expert code reviewer for game development. Review the following game code generated by Chatbot1.
          The game is intended for the RandomPlayables platform, often as a React/TypeScript sketch or a self-contained HTML file.
          Please look for:
          - Bugs, syntax errors, or logical errors.
          - Adherence to the GameLab requirements (React+TS for sketches, self-contained HTML, use of #game-container, DOM event listeners, sandbox compatibility).
          - Completeness of the code for its intended purpose (e.g., a full HTML file if requested, or a complete App.tsx).
          - Potential issues when running in a sandboxed iframe.
          - Clarity, efficiency, and best practices for web game development.

          Provide concise and actionable feedback.

          Original User Prompt to Chatbot1:
          ---
          ${userQuery}
          ---

          System Prompt used for Chatbot1:
          ---
          ${finalSystemPrompt}
          ---

          Code generated by Chatbot1 (Language: ${initialLanguage}):
          ---
          \`\`\`${initialLanguage}
          ${initialCode}
          \`\`\`
          ---
          Your review:
        `;
        const messagesToChatbot2 = [{ role: "user", content: reviewPrompt }];
        const response2 = await callOpenAIChat(chatbot2Model, messagesToChatbot2);
        const reviewFromChatbot2 = response2.choices[0].message.content || "No review feedback provided.";

        // 3. Chatbot1 revises the code based on review
        const revisionPrompt = `
          You are an AI game development assistant. You generated the initial game code below.
          Another AI (Chatbot2) has reviewed your code and provided feedback.
          Please carefully consider the feedback and revise your original code to address the points raised.
          Ensure the revised code still accurately addresses the original user prompt and adheres to ALL requirements in the original system prompt you received (e.g., React+TS for sketches, complete single HTML file, etc.).
          Output ONLY the complete, revised code block. Do not include any other explanatory text or markdown formatting outside the code block.

          Original User Prompt:
          ---
          ${userQuery}
          ---

          Original System Prompt You Followed:
          ---
          ${finalSystemPrompt}
          ---

          Your Initial Code (Language: ${initialLanguage}):
          ---
          \`\`\`${initialLanguage}
          ${initialCode}
          \`\`\`
          ---

          Chatbot2's Review of Your Code:
          ---
          ${reviewFromChatbot2}
          ---

          Your Revised Code (only the code block in the correct language, ${initialLanguage}):
        `;
        const messagesToChatbot1Revision = [
          systemMessage,
          { role: "user", content: revisionPrompt }
        ];
        const response3 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Revision);
        const revisedGenerationContent = response3.choices[0].message.content;
        const { code: revisedCode, language: revisedLanguage, message_text: revisedMessageText } = extractGameLabCodeFromResponse(revisedGenerationContent, initialLanguage);
        
        finalApiResponse = {
          message: `Code generated with review. Initial AI message: "${initialMessageText}". Review: "${reviewFromChatbot2}". Final AI message: "${revisedMessageText}"`,
          code: revisedCode,
          language: revisedLanguage,
        };
      }
    } else {
      // Original Flow (No Code Review)
      const { model, canUseApi, remainingRequests: modelSelectionRemaining } = await getModelForUser(clerkUser.id);
    
      if (!canUseApi) {
        return NextResponse.json({ 
          error: "Monthly API request limit reached. Please upgrade your plan.", 
          limitReached: true 
        }, { status: 403 });
      }
      
      const messagesToAI = [systemMessage, ...initialUserMessages];
      const response = await callOpenAIChat(model, messagesToAI);
      const aiResponseContent = response.choices[0].message.content;
      const { code, language, message_text } = extractGameLabCodeFromResponse(aiResponseContent);
    
      finalApiResponse = {
        message: message_text,
        code: code,
        language: language,
        remainingRequests: modelSelectionRemaining
      };
    }

    await incrementApiUsage(clerkUser.id);
    const usageData = await prisma.apiUsage.findUnique({ where: { userId: clerkUser.id } });
    const remainingRequestsAfterIncrement = Math.max(0, (usageData?.monthlyLimit || 0) - (usageData?.usageCount || 0));
    finalApiResponse.remainingRequests = remainingRequestsAfterIncrement;
    
    return NextResponse.json(finalApiResponse);
    
  } catch (error: any) {
    console.error("Error in GameLab chat:", error);
    let errorDetails = error.message;
    if (error.response && error.response.data && error.response.data.error) {
        errorDetails = error.response.data.error.message || error.message;
    }
    return NextResponse.json(
      { error: "Failed to generate game code", details: errorDetails, stack: error.stack },
      { status: 500 }
    );
  }
}

// Ensure global 'window' properties for sendDataToGameLab and GAMELAB_SESSION_ID are declared for App.tsx example
declare global {
  interface Window {
    sendDataToGameLab?: (data: any) => void;
    GAMELAB_SESSION_ID?: string;
  }
}