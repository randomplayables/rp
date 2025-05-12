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
    
    const systemPrompt = `
    You are an AI game development assistant for RandomPlayables, a platform for mathematical citizen science games.
    
    Your goal is to help users create games that can be deployed on the RandomPlayables platform. You have access to 
    existing game examples and the platform's database structure to guide your recommendations.
    
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
    
    Here's an example of a properly structured game:
    
    \`\`\`html
${htmlExample}
    \`\`\`
    
    When designing games:
    1. Focus on games that explore mathematical concepts, probability, or scientific reasoning
    2. Keep the code simple and maintainable
    3. Generate complete, self-contained HTML files as shown in the example
    4. Provide clear documentation and comments
    
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
    3. Provide a COMPLETE self-contained HTML file with embedded CSS and JavaScript
    4. Explain how the game would integrate with the RandomPlayables platform
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
      
      // Generate a clean message text by removing all code blocks
      message_text = aiResponse.replace(/```[a-zA-Z0-9+#]*\n[\s\S]*?```/g, "").trim();
      
      // Extract HTML boilerplate if present within the code
      if (code.includes("<!DOCTYPE html>") || code.includes("<html")) {
        const htmlMatch = code.match(/<html[\s\S]*?<\/html>/);
        if (htmlMatch) {
          code = htmlMatch[0];
        }
      }
    } else {
      // If no markdown code block, attempt alternative extraction methods
      const htmlMatch = aiResponse.match(/<html[\s\S]*?<\/html>/);
      if (htmlMatch) {
        code = htmlMatch[0];
        message_text = aiResponse.replace(htmlMatch[0], "").trim();
        language = "html";
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
        }
      }
    }

    console.log("Extracted code length:", code.length);
    console.log("Extracted language:", language);
    
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