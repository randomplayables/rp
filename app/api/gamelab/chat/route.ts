import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { fetchRepoContent, extractRepoInfo } from "@/lib/githubApi";
import CodeBaseModel from "@/models/CodeBase";
import { currentUser } from "@clerk/nextjs/server";

const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// Helper function to get game code based on game id or description
async function fetchGameCode(query: string) {
  try {
    await connectToDatabase();
    console.log("Using cached MongoDB connection");
    
    // First get all games to check if any are mentioned in the query
    const allGames = await GameModel.find({}).lean();
    console.log(`Found ${allGames.length} games in the database`);
    
    let selectedGames = [];
    
    // Check if the query mentions any specific games
    const mentionedGames = allGames.filter(game => 
      query.toLowerCase().includes(game.name?.toLowerCase())
    );
    
    if (mentionedGames.length > 0) {
      // If specific games are mentioned, use those
      selectedGames = mentionedGames;
      console.log(`Query mentions specific games: ${mentionedGames.map(g => g.name).join(', ')}`);
    } else {
      // Otherwise, use a few games to provide context (limit to 3 for performance)
      selectedGames = allGames.slice(0, 3);
      console.log(`No specific games mentioned, using ${selectedGames.length} games for context`);
    }
    
    console.log("🔍 GameLab: Found matching games in database:", 
      selectedGames.map(g => g.name).join(", ") || "None");
    
    const gameCodeContext: Record<string, any> = {};
    
    // For each game, fetch code from MongoDB CodeBase collection
    for (const game of selectedGames) {
      console.log(`🔍 GameLab: Looking for codebase for ${game.name} (ID: ${game.id})`);
      
      // Find codebase in MongoDB
      const codebase = await CodeBaseModel.findOne({ gameId: game.id }).lean();
      
      if (codebase) {
        console.log(`🔍 GameLab: Found codebase for ${game.name}`);
        
        // Process based on content type
        if (codebase.contentType === "repomix-xml") {
          // Parse XML to extract components
          const parsedCode = parseRepomixXml(codebase.codeContent);
          
          gameCodeContext[game.name] = {
            id: game.id,
            name: game.name,
            // Include parsed code examples
            packageJson: parsedCode.packageJson,
            componentExamples: parsedCode.components,
          };
        } else {
          // Simple extraction for raw code
          const components = extractComponentsFromCode(codebase.codeContent);
          
          gameCodeContext[game.name] = {
            id: game.id,
            name: game.name,
            componentExamples: components,
          };
        }
        
        console.log(`🔍 GameLab: Successfully added ${game.name} to context`);
      } else {
        console.log(`🔍 GameLab: No codebase found for ${game.name}`);
      }
    }
    
    return gameCodeContext;
  } catch (error) {
    console.error("🔍 GameLab: Error fetching game code:", error);
    return {};
  }
}

// Helper functions to parse codebase content
function parseRepomixXml(xmlContent: string) {
  // Add explicit type annotations to fix the TypeScript errors
  const result: {
    packageJson: any | null;
    components: Array<{ name: string; content: string }>;
    services: Array<{ name: string; content: string }>;
    types: Array<{ name: string; content: string }>;
  } = {
    packageJson: null,
    components: [],
    services: [],
    types: []
  };
  
  try {
    // Look for package.json content
    const packageJsonMatch = xmlContent.match(/<file path="package\.json">([\s\S]*?)<\/file>/);
    if (packageJsonMatch && packageJsonMatch[1]) {
      try {
        result.packageJson = JSON.parse(packageJsonMatch[1]);
      } catch (e) {
        console.log("Could not parse package.json");
      }
    }
    
    // Extract components
    const fileMatches = xmlContent.match(/<file path="([^"]+)">([\s\S]*?)<\/file>/g) || [];
    
    for (const fileMatch of fileMatches) {
      const pathMatch = fileMatch.match(/<file path="([^"]+)">/);
      if (pathMatch) {
        const path = pathMatch[1];
        const content = fileMatch.replace(/<file path="[^"]+">/g, '').replace('</file>', '');
        
        // Determine file type based on path
        if (path.includes('/components/') || path.endsWith('.jsx') || path.endsWith('.tsx')) {
          result.components.push({
            name: path,
            content: content
          });
        } else if (path.includes('/services/') || path.includes('/api/')) {
          result.services.push({
            name: path,
            content: content
          });
        } else if (path.includes('/types/') || path.includes('.d.ts')) {
          result.types.push({
            name: path,
            content: content
          });
        }
      }
    }
    
  } catch (error) {
    console.error("Error parsing Repomix XML:", error);
  }
  
  return result;
}

function extractComponentsFromCode(codeContent: string) {
  // A simple implementation to extract components from raw code
  // This can be customized based on your codebase structure
  const components = [];
  
  // Split the code into potential components by looking for component patterns
  const componentMatches = codeContent.match(/(?:class|function|const)\s+(\w+)(?:\s+extends\s+React\.Component|\s+=\s+\(\)|Component)/g) || [];
  
  // For each potential component, get the surrounding code
  for (const match of componentMatches) {
    const componentName = match.split(/\s+/)[1]; // Extract component name
    
    // Find the start of the component
    const startIndex = codeContent.indexOf(match);
    if (startIndex === -1) continue;
    
    // Try to find the end (this is a simplistic approach - could be improved)
    let braceCount = 0;
    let endIndex = startIndex;
    
    // Simple brace matching to find component boundaries
    for (let i = startIndex; i < codeContent.length; i++) {
      if (codeContent[i] === '{') braceCount++;
      if (codeContent[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    // Extract the component code
    const componentCode = codeContent.substring(startIndex, endIndex);
    
    components.push({
      name: componentName,
      content: componentCode
    });
  }
  
  return components;
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

// HTML Example as a separate string to avoid template string issues
const htmlExample = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Number Guessing Game</title>
  <style>
    body, html { 
      margin: 0; 
      padding: 0; 
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f0f0f0;
    }
    #game-container {
      width: 80%;
      max-width: 600px;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    button {
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 10px 15px;
      font-size: 16px;
      cursor: pointer;
      border-radius: 4px;
      margin-top: 10px;
    }
    input {
      padding: 8px;
      font-size: 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-right: 5px;
    }
  </style>
</head>
<body>
  <div id="game-container">
    <h1>Number Guessing Game</h1>
    <p id="message">I'm thinking of a number between 1 and 100. Can you guess it?</p>
    <div>
      <input type="number" id="guess-input" min="1" max="100">
      <button id="submit-btn">Submit</button>
    </div>
    <p id="attempts">Attempts: 0</p>
  </div>
  
  <script>
    // Game initialization code
    const messageElement = document.getElementById('message');
    const guessInput = document.getElementById('guess-input');
    const submitButton = document.getElementById('submit-btn');
    const attemptsElement = document.getElementById('attempts');
    
    // Game state
    let gameState = {
      secretNumber: Math.floor(Math.random() * 100) + 1,
      attempts: 0,
      gameOver: false
    };
    
    // Event listeners
    submitButton.addEventListener('click', makeGuess);
    
    function makeGuess() {
      if (gameState.gameOver) return;
      
      const guess = parseInt(guessInput.value);
      
      if (isNaN(guess) || guess < 1 || guess > 100) {
        messageElement.textContent = "Please enter a valid number between 1 and 100";
        return;
      }
      
      gameState.attempts++;
      attemptsElement.textContent = \`Attempts: \${gameState.attempts}\`;
      
      if (guess === gameState.secretNumber) {
        messageElement.textContent = \`Congratulations! You guessed the number \${gameState.secretNumber} in \${gameState.attempts} attempts!\`;
        messageElement.style.color = "green";
        gameState.gameOver = true;
        
        // Create play again button
        const playAgainBtn = document.createElement('button');
        playAgainBtn.textContent = "Play Again";
        playAgainBtn.addEventListener('click', resetGame);
        document.getElementById('game-container').appendChild(playAgainBtn);
      } else if (guess < gameState.secretNumber) {
        messageElement.textContent = "Too low! Try a higher number.";
      } else {
        messageElement.textContent = "Too high! Try a lower number.";
      }
      
      guessInput.value = "";
      guessInput.focus();
    }
    
    function resetGame() {
      gameState.secretNumber = Math.floor(Math.random() * 100) + 1;
      gameState.attempts = 0;
      gameState.gameOver = false;
      
      messageElement.textContent = "I'm thinking of a new number between 1 and 100. Can you guess it?";
      messageElement.style.color = "black";
      attemptsElement.textContent = "Attempts: 0";
      
      // Remove play again button
      const playAgainBtn = document.querySelector('#game-container button:last-child');
      if (playAgainBtn && playAgainBtn.textContent === "Play Again") {
        playAgainBtn.remove();
      }
    }
  </script>
</body>
</html>`;

export async function POST(request: NextRequest) {
  try {
    // Get user message, chat history, and optional custom system prompt
    const { message, chatHistory, systemPrompt: customSystemPrompt } = await request.json();
    
    console.log("🔍 GameLab: Processing chat request with query:", message);
    
    // Fetch relevant game code examples based on the query
    const gameCodeExamples = await fetchGameCode(message);
    
    console.log("🔍 GameLab: Found code examples in database:", 
      Object.keys(gameCodeExamples).length > 0 ? 
      Object.keys(gameCodeExamples).join(", ") : 
      "None");
    
    // If you find any, add more detail
    if (Object.keys(gameCodeExamples).length > 0) {
      console.log("🔍 GameLab: First example contains components:", 
        gameCodeExamples[Object.keys(gameCodeExamples)[0]]?.componentExamples?.length || 0);
    }
    
    // Get template structures
    const templateStructure = getTemplateStructure();
    
    console.log("🔍 GameLab: Sending prompt to AI with code examples:", 
      Object.keys(gameCodeExamples).length > 0 ? "Yes" : "No");
    
    // Use the custom system prompt if provided, otherwise use the default
    const systemPrompt = customSystemPrompt || `
    You are an AI game development assistant for RandomPlayables, a platform for mathematical citizen science games.
    
    Your goal is to help users create games that can be deployed on the RandomPlayables platform. You have access to 
    existing game examples and their codebases to guide your recommendations.
    
    IMPORTANT REQUIREMENTS FOR ALL GAMES YOU CREATE:
    
    1. Every game MUST be delivered as a COMPLETE single HTML file with:
       - Proper DOCTYPE and HTML structure
       - CSS in a <style> tag in the head
       - JavaScript in a <script> tag before the body closing tag
       - A <div id="game-container"></div> element that the JavaScript code interacts with
    
    2. Interactive elements MUST use standard DOM event listeners, for example:
       document.getElementById('button-id').addEventListener('click', handleClick);
    
    3. All JavaScript code must reference elements by ID or create elements dynamically.
    
    4. The game should work entirely in a sandbox environment without external dependencies.
    
    REAL CODE EXAMPLES FROM EXISTING GAMES:
    ${JSON.stringify(gameCodeExamples, null, 2)}
    
    When designing games based on existing code examples:
    1. Follow similar patterns for game structure and organization
    2. Use the same approach for connecting to the RandomPlayables platform APIs
    3. Implement similar data structures for game state and scoring
    4. Import any necessary type definitions
    
    When handling platform integration:
    1. Every game should connect to the RandomPlayables platform using the provided API service patterns
    2. Use sessionId to track game sessions
    3. Send game data to the platform for scoring and analysis
    
    Example of a complete game:
    
    \`\`\`html
${htmlExample}
    \`\`\`
    
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
    3. Provide a COMPLETE self-contained HTML file with embedded CSS and JavaScript
    4. Explain how the game would integrate with the RandomPlayables platform
    `;
    
    console.log("🔍 GameLab: Sending prompt to AI with code examples:", 
      Object.keys(gameCodeExamples).length > 0 ? "Yes" : "No");
    
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
    console.log("🔍 GameLab: Received AI response of length:", aiResponse.length);
    
    // Extract code from the response
    let code = "";
    let language = "html"; // Default to HTML since we're focusing on complete HTML files
    let message_text = aiResponse;

    // Enhanced regex that handles code blocks
    const codeBlockRegex = /```([a-zA-Z0-9+#]+)?\n([\s\S]*?)```/g;
    const codeBlocks: Array<[string, string, string]> = [];
    
    // Extract all code blocks
    let match;
    while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
      // match[1] = language, match[2] = code
      codeBlocks.push([match[0], match[1] || '', match[2]]);
    }

    if (codeBlocks.length > 0) {
      // Get the most substantial code block (usually the last or longest one)
      const mainCodeBlock = codeBlocks.reduce((longest, current) => {
        return current[2].length > longest[2].length ? current : longest;
      }, codeBlocks[0]);
      
      if (mainCodeBlock[1]) {
        language = mainCodeBlock[1].toLowerCase();
      }
      
      code = mainCodeBlock[2].trim();
      console.log("🔍 GameLab: Extracted code block of length:", code.length, "language:", language);
      
      // Generate a clean message text by removing all code blocks
      message_text = aiResponse.replace(/```[a-zA-Z0-9+#]*\n[\s\S]*?```/g, "").trim();
      
      // Extract HTML boilerplate if present within the code
      if (code.includes("<!DOCTYPE html>") || code.includes("<html")) {
        const htmlMatch = code.match(/<html[\s\S]*?<\/html>/);
        if (htmlMatch) {
          code = htmlMatch[0];
          console.log("🔍 GameLab: Found complete HTML in code block, length:", code.length);
        }
      }
    } else {
      // If no markdown code block, attempt alternative extraction methods
      const htmlMatch = aiResponse.match(/<html[\s\S]*?<\/html>/);
      if (htmlMatch) {
        code = htmlMatch[0];
        message_text = aiResponse.replace(htmlMatch[0], "").trim();
        language = "html";
        console.log("🔍 GameLab: Extracted HTML directly from response, length:", code.length);
      } else {
        // Last resort: try to find script tags
        const scriptMatch = aiResponse.match(/<script[\s\S]*?<\/script>/);
        if (scriptMatch) {
          // Wrap in minimal HTML
          code = `<!DOCTYPE html>
<html>
<head>
  <title>Game</title>
</head>
<body>
  <div id="game-container"></div>
  ${scriptMatch[0]}
</body>
</html>`;
          message_text = aiResponse.replace(scriptMatch[0], "").trim();
          language = "html";
          console.log("🔍 GameLab: Found script tag and wrapped in HTML, length:", code.length);
        } else {
          console.log("🔍 GameLab: No code blocks or HTML found in response");
        }
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