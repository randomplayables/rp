import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";
import { 
    getTemplateStructure, 
    fetchGameCodeExamplesForQuery,
} from "./gamelabHelper";

// New React + TypeScript example for the prompt
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
});

function createModelRequest(model: string, messages: any[]) {
  return {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: model.includes('o4-mini') ? 4000 : 2000, // Adjusted based on your existing logic
  };
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message: userQuery, chatHistory, customSystemPrompt } = await request.json();
    
    const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id);
    
    if (!canUseApi) {
      return NextResponse.json({ 
        error: "Monthly API request limit reached. Please upgrade your plan.", 
        limitReached: true 
      }, { status: 403 });
    }
    
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
        const templateStructure = getTemplateStructure();
        finalSystemPrompt = finalSystemPrompt.replace(
          '%%GAMELAB_TEMPLATE_STRUCTURES%%',
          JSON.stringify(templateStructure, null, 2)
        );
      }
    } else {
      console.log("GameLab Chat API: No customSystemPrompt from frontend, using fallback.");
      const templateStructure = getTemplateStructure();
      finalSystemPrompt = FALLBACK_GAMELAB_SYSTEM_PROMPT_TEMPLATE
        .replace('%%GAMELAB_TEMPLATE_STRUCTURES%%', JSON.stringify(templateStructure, null, 2))
        .replace('%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%', gameCodeExamplesString);
    }
    
    const messagesToAI = [
      { role: "system", content: finalSystemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: userQuery }
    ];
    
    const response = await openAI.chat.completions.create(
      createModelRequest(model, messagesToAI as any)
    );

    await incrementApiUsage(clerkUser.id);
    
    const aiResponseContent = response.choices[0].message.content!;
    let code = "";
    // Default to tsx as per new guidelines
    let language = "tsx"; 
    let message_text = aiResponseContent;

    // Enhanced code extraction logic (from original file, slight modification for tsx default)
    const codeBlockRegex = /```([a-zA-Z0-9+#-_]+)?\n([\s\S]*?)```/g; // Allow hyphen in lang name e.g. react-typescript
    const codeBlocks: Array<[string, string, string]> = [];
    let match;
    while ((match = codeBlockRegex.exec(aiResponseContent)) !== null) {
        codeBlocks.push([match[0], match[1] || '', match[2]]);
    }

    if (codeBlocks.length > 0) {
        // Try to find the main App.tsx or a TSX/JSX block first
        const tsxBlock = codeBlocks.find(block => ['tsx', 'typescript', 'jsx', 'javascript', 'react'].includes(block[1].toLowerCase()));
        const mainCodeBlock = tsxBlock || codeBlocks.reduce((longest, current) => current[2].length > longest[2].length ? current : longest, codeBlocks[0]);
        
        language = mainCodeBlock[1].toLowerCase() || 'tsx'; // Default to tsx if language not specified
        if (['typescript', 'javascript', 'react'].includes(language)) language = 'tsx'; // Normalize to tsx
        if (language === 'html' && mainCodeBlock[2].includes('<script type="text/babel">')) language = 'tsx';


        code = mainCodeBlock[2].trim();
        // Remove identified code block(s) from message_text
        // This needs to be more robust if multiple blocks are expected for a project structure
        message_text = aiResponseContent;
        for (const block of codeBlocks) {
            message_text = message_text.replace(block[0], `\n[Code for ${block[1] || 'file'} was generated]\n`);
        }
        message_text = message_text.trim();

    } else { 
        // No ```code blocks``` found. Try to heuristically find React/TSX code.
        // This is less reliable. The AI should be prompted to use markdown code blocks.
        if ((aiResponseContent.includes("React.FC") || aiResponseContent.includes("useState") || aiResponseContent.includes("useEffect")) && (aiResponseContent.includes("const App") || aiResponseContent.includes("function App"))) {
            code = aiResponseContent; // Assume the whole response is the App.tsx code
            language = "tsx";
            message_text = "Generated React/TypeScript component:";
        } else if (aiResponseContent.includes("<!DOCTYPE html>")) { // Fallback for HTML if explicitly generated
            code = aiResponseContent;
            language = "html";
            message_text = "Generated HTML content:";
        }
         // If still no specific code, and the response is short, it might be just a message.
        else if (aiResponseContent.length < 200 && !aiResponseContent.match(/<[^>]+>/) && !aiResponseContent.includes("import React")) { 
            code = ""; 
            message_text = aiResponseContent;
        } else { 
            // Fallback: treat the whole response as code, default language to tsx
            code = aiResponseContent;
            language = "tsx";
            message_text = "Here's the code I generated (assuming React/TSX):";
        }
    }
    
    // If the AI provides multiple files, it should be in the message_text,
    // and the 'code' variable would contain the primary file (e.g., App.tsx).
    // The prompt guides for this.

    return NextResponse.json({
      message: message_text,
      code: code,
      language: language, // Send detected or default language
      remainingRequests
    });
    
  } catch (error: any) {
    console.error("Error in GameLab chat:", error);
    return NextResponse.json(
      { error: "Failed to generate game code", details: error.message, stack: error.stack },
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