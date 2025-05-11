import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";

const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// Helper function to get game code based on game id or description
async function fetchGameCode(query: string) {
  try {
    await connectToDatabase();
    
    // Find games that might match the query
    const games = await GameModel.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).limit(5).lean();
    
    const gameCodeContext: Record<string, any> = {};
    
    // For each game, try to extract GitHub repo info
    for (const game of games) {
      if (game.irlInstructions && game.irlInstructions.length > 0) {
        for (const instruction of game.irlInstructions) {
          if (instruction.url && instruction.url.includes('github.com')) {
            // Extract GitHub repo URL
            const urlParts = instruction.url.split('/');
            const repoIndex = urlParts.indexOf('github.com');
            
            if (repoIndex !== -1 && urlParts.length >= repoIndex + 3) {
              const repoOwner = urlParts[repoIndex + 1];
              const repoName = urlParts[repoIndex + 2];
              const repoUrl = `https://github.com/${repoOwner}/${repoName}`;
              
              gameCodeContext[game.name] = {
                id: game.id,
                name: game.name,
                repoUrl,
                instructionUrl: instruction.url
              };
            }
          }
        }
      }
    }
    
    return gameCodeContext;
  } catch (error) {
    console.error("Error fetching game code:", error);
    return {};
  }
}

// Helper function to get a sample template structure
function getTemplateStructure() {
  return {
    basic: {
      files: [
        {
          name: "index.html",
          content: "<!DOCTYPE html>\n<html>\n<head>\n  <title>RandomPlayables Game</title>\n  <link rel=\"stylesheet\" href=\"styles.css\">\n</head>\n<body>\n  <div id=\"game-container\"></div>\n  <script src=\"game.js\"></script>\n</body>\n</html>"
        },
        {
          name: "styles.css",
          content: "body {\n  margin: 0;\n  padding: 0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n  background-color: #f0f0f0;\n}\n\n#game-container {\n  width: 800px;\n  height: 600px;\n  background-color: white;\n  border: 1px solid #ccc;\n}"
        },
        {
          name: "game.js",
          content: "// Game initialization code here\nconst gameContainer = document.getElementById('game-container');\n\n// Game state\nlet gameState = {\n  // Add your game state variables here\n};\n\n// Game loop\nfunction gameLoop() {\n  // Update game state\n  \n  // Render game\n  \n  // Request next frame\n  requestAnimationFrame(gameLoop);\n}\n\n// Start game\ngameLoop();"
        }
      ]
    },
    react: {
      files: [
        {
          name: "App.jsx",
          content: "import { useState, useEffect } from 'react';\nimport './App.css';\n\nfunction App() {\n  const [gameState, setGameState] = useState({\n    // Initialize your game state here\n  });\n\n  useEffect(() => {\n    // Game initialization code\n    \n    // Optional cleanup\n    return () => {\n      // Cleanup code\n    };\n  }, []);\n\n  // Game logic functions\n  \n  return (\n    <div className=\"game-container\">\n      {/* Game UI components */}\n    </div>\n  );\n}\n\nexport default App;"
        }
      ]
    },
    mongodb: {
      gameStructure: {
        id: "unique-game-id",
        name: "Game Name",
        description: "Short game description",
        year: 2025,
        image: "url-to-game-thumbnail",
        link: "url-to-deployed-game",
        irlInstructions: [
          {
            title: "How to Play",
            url: "url-to-instructions"
          }
        ]
      },
      gameSession: {
        sessionId: "unique-session-id",
        userId: "user-id-from-clerk",
        gameId: "game-id-reference",
        startTime: "timestamp",
        isGuest: false
      },
      gameData: {
        sessionId: "session-id-reference",
        gameId: "game-id-reference",
        userId: "user-id-reference",
        roundNumber: 1,
        roundData: {
          score: 0,
          actions: [],
          completed: false
        }
      }
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const { message, chatHistory } = await request.json();
    
    // Fetch relevant game code examples based on the query
    const gameCodeExamples = await fetchGameCode(message);
    
    // Get template structures
    const templateStructure = getTemplateStructure();
    
    const systemPrompt = `
    You are an AI game development assistant for RandomPlayables, a platform for mathematical citizen science games.
    
    Your goal is to help users create games that can be deployed on the RandomPlayables platform. You have access to 
    existing game examples and the platform's database structure to guide your recommendations.
    
    When designing games:
    1. Focus on games that explore mathematical concepts, probability, or scientific reasoning
    2. Keep the code simple and maintainable
    3. Follow the structure of existing RandomPlayables games
    4. Generate complete, runnable code that would work on the platform
    5. Provide clear documentation and comments
    
    Available game examples:
    ${JSON.stringify(gameCodeExamples, null, 2)}
    
    Template structures for new games:
    ${JSON.stringify(templateStructure, null, 2)}
    
    MongoDB database structure for games:
    - Games collection: Stores metadata about each game
    - GameSessions collection: Tracks user play sessions
    - GameData collection: Stores gameplay data for analysis
    
    These games will be deployed on RandomPlayables.com as subdomains (e.g., gamename.randomplayables.com).
    
    When responding:
    1. First understand the user's game idea and ask clarifying questions if needed
    2. Suggest a clear game structure and mechanics
    3. Provide well-structured, well-commented code for the game
    4. Explain how the game would integrate with the RandomPlayables platform
    5. Include platform-specific considerations like database integration
    
    Always return your code responses in a format that can be easily copied and used by the user. When generating code,
    include proper language identifier (e.g., javascript, typescript, jsx, tsx, html, css) in your response.
    `;
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: message }
    ];
    
    const response = await openAI.chat.completions.create({
      model: "meta-llama/llama-3.2-3b-instruct:free", // You can use a stronger model if available
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 3000,
    });
    
    const aiResponse = response.choices[0].message.content!;
    
    // Extract code from the response
    let code = "";
    let language = "javascript";
    let message_text = aiResponse;
    
    // Try to extract code between backticks with language
    const codeMatch = aiResponse.match(/```([a-zA-Z0-9+#]+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      if (codeMatch[1]) {
        language = codeMatch[1].toLowerCase();
      }
      code = codeMatch[2].trim();
      // Remove the code block from the message text
      message_text = aiResponse.replace(/```[a-zA-Z0-9+#]*\n[\s\S]*?```/, "").trim();
    } else {
      // If no markdown code block, try to identify code blocks by indentation or other patterns
      const parts = aiResponse.split('\n\n');
      if (parts.length > 1) {
        message_text = parts[0];
        code = parts.slice(1).join('\n\n');
      }
    }
    
    return NextResponse.json({
      message: message_text,
      code: code,
      language: language
    });
    
  } catch (error: any) {
    console.error("Error in GameLab chat:", error);
    return NextResponse.json(
      { error: "Failed to generate game code", details: error.message },
      { status: 500 }
    );
  }
}