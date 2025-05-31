// import { NextRequest, NextResponse } from "next/server";
// import OpenAI from "openai";
// import { connectToDatabase } from "@/lib/mongodb";
// import GameModel from "@/models/Game";
// import { fetchRepoContent, extractRepoInfo } from "@/lib/githubApi";
// import CodeBaseModel from "@/models/CodeBase";
// import { currentUser } from "@clerk/nextjs/server"; // Added
// import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection"; // Added

// function createModelRequest(model: string, messages: any[], prompt: string) {
//   // Basic request that works for all models
//   const baseRequest = {
//     model: model,
//     messages: messages,
//     temperature: 0.7,
//     max_tokens: model.includes('o4-mini') ? 4000 : 2000, // Longer responses for more powerful models
//   };

//   // Add any model-specific configurations
//   if (model.includes('openai/')) {
//     // OpenAI models may need different formatting
//     console.log(`Using OpenAI model: ${model}`);
//   } else {
//     // Llama models use the standard format
//     console.log(`Using standard model: ${model}`);
//   }

//   return baseRequest;
// }

// const openAI = new OpenAI({
//   apiKey: process.env.OPEN_ROUTER_API_KEY,
//   baseURL: "https://openrouter.ai/api/v1",
// });

// async function fetchGameCode(query: string) {
//   try {
//     await connectToDatabase();
//     console.log("Using cached MongoDB connection");
    
//     const allGames = await GameModel.find({}).lean();
//     console.log(`Found ${allGames.length} games in the database`);
    
//     let selectedGames = [];
    
//     const mentionedGames = allGames.filter(game => 
//       query.toLowerCase().includes(game.name?.toLowerCase())
//     );
    
//     if (mentionedGames.length > 0) {
//       selectedGames = mentionedGames;
//       console.log(`Query mentions specific games: ${mentionedGames.map(g => g.name).join(', ')}`);
//     } else {
//       selectedGames = allGames.slice(0, 3);
//       console.log(`No specific games mentioned, using ${selectedGames.length} games for context`);
//     }
    
//     console.log("🔍 GameLab: Found matching games in database:", 
//       selectedGames.map(g => g.name).join(", ") || "None");
    
//     const gameCodeContext: Record<string, any> = {};
    
//     for (const game of selectedGames) {
//       console.log(`🔍 GameLab: Looking for codebase for ${game.name} (ID: ${game.id})`);
      
//       const codebase = await CodeBaseModel.findOne({ gameId: game.id }).lean();
      
//       if (codebase) {
//         console.log(`🔍 GameLab: Found codebase for ${game.name}`);
        
//         if (codebase.contentType === "repomix-xml") {
//           const parsedCode = parseRepomixXml(codebase.codeContent);
          
//           gameCodeContext[game.name] = {
//             id: game.id,
//             name: game.name,
//             packageJson: parsedCode.packageJson,
//             componentExamples: parsedCode.components,
//           };
//         } else {
//           const components = extractComponentsFromCode(codebase.codeContent);
          
//           gameCodeContext[game.name] = {
//             id: game.id,
//             name: game.name,
//             componentExamples: components,
//           };
//         }
        
//         console.log(`🔍 GameLab: Successfully added ${game.name} to context`);
//       } else {
//         console.log(`🔍 GameLab: No codebase found for ${game.name}`);
//       }
//     }
    
//     return gameCodeContext;
//   } catch (error) {
//     console.error("🔍 GameLab: Error fetching game code:", error);
//     return {};
//   }
// }

// function parseRepomixXml(xmlContent: string) {
//   const result: {
//     packageJson: any | null;
//     components: Array<{ name: string; content: string }>;
//     services: Array<{ name: string; content: string }>;
//     types: Array<{ name: string; content: string }>;
//   } = {
//     packageJson: null,
//     components: [],
//     services: [],
//     types: []
//   };
  
//   try {
//     const packageJsonMatch = xmlContent.match(/<file path="package\.json">([\s\S]*?)<\/file>/);
//     if (packageJsonMatch && packageJsonMatch[1]) {
//       try {
//         result.packageJson = JSON.parse(packageJsonMatch[1]);
//       } catch (e) {
//         console.log("Could not parse package.json");
//       }
//     }
    
//     const fileMatches = xmlContent.match(/<file path="([^"]+)">([\s\S]*?)<\/file>/g) || [];
    
//     for (const fileMatch of fileMatches) {
//       const pathMatch = fileMatch.match(/<file path="([^"]+)">/);
//       if (pathMatch) {
//         const path = pathMatch[1];
//         const content = fileMatch.replace(/<file path="[^"]+">/g, '').replace('</file>', '');
        
//         if (path.includes('/components/') || path.endsWith('.jsx') || path.endsWith('.tsx')) {
//           result.components.push({
//             name: path,
//             content: content
//           });
//         } else if (path.includes('/services/') || path.includes('/api/')) {
//           result.services.push({
//             name: path,
//             content: content
//           });
//         } else if (path.includes('/types/') || path.includes('.d.ts')) {
//           result.types.push({
//             name: path,
//             content: content
//           });
//         }
//       }
//     }
    
//   } catch (error) {
//     console.error("Error parsing Repomix XML:", error);
//   }
  
//   return result;
// }

// function extractComponentsFromCode(codeContent: string) {
//   const components = [];
//   const componentMatches = codeContent.match(/(?:class|function|const)\s+(\w+)(?:\s+extends\s+React\.Component|\s+=\s+\(\)|Component)/g) || [];
  
//   for (const match of componentMatches) {
//     const componentName = match.split(/\s+/)[1];
//     const startIndex = codeContent.indexOf(match);
//     if (startIndex === -1) continue;
    
//     let braceCount = 0;
//     let endIndex = startIndex;
    
//     for (let i = startIndex; i < codeContent.length; i++) {
//       if (codeContent[i] === '{') braceCount++;
//       if (codeContent[i] === '}') {
//         braceCount--;
//         if (braceCount === 0) {
//           endIndex = i + 1;
//           break;
//         }
//       }
//     }
    
//     const componentCode = codeContent.substring(startIndex, endIndex);
    
//     components.push({
//       name: componentName,
//       content: componentCode
//     });
//   }
  
//   return components;
// }

// function getTemplateStructure() {
//   return {
//     basic: {
//       files: [
//         {
//           name: "index.html",
//           content: "<!DOCTYPE html>\n<html>\n<head>\n  <title>RandomPlayables Game</title>\n  <link rel=\"stylesheet\" href=\"styles.css\">\n</head>\n<body>\n  <div id=\"game-container\"></div>\n  <script src=\"game.js\"></script>\n</body>\n</html>"
//         },
//         {
//           name: "styles.css",
//           content: "body {\n  margin: 0;\n  padding: 0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n  background-color: #f0f0f0;\n}\n\n#game-container {\n  width: 800px;\n  height: 600px;\n  background-color: white;\n  border: 1px solid #ccc;\n}"
//         },
//         {
//           name: "game.js",
//           content: "// Game initialization code here\nconst gameContainer = document.getElementById('game-container');\n\n// Game state\nlet gameState = {\n  // Add your game state variables here\n};\n\n// Game loop\nfunction gameLoop() {\n  // Update game state\n  \n  // Render game\n  \n  // Request next frame\n  requestAnimationFrame(gameLoop);\n}\n\n// Start game\ngameLoop();"
//         }
//       ]
//     },
//     mongodb: {
//       gameStructure: {
//         id: "unique-game-id",
//         name: "Game Name",
//         description: "Short game description",
//         year: 2025,
//         image: "url-to-game-thumbnail",
//         link: "url-to-deployed-game",
//         irlInstructions: [
//           {
//             title: "How to Play",
//             url: "url-to-instructions"
//           }
//         ]
//       },
//       gameSession: {
//         sessionId: "unique-session-id",
//         userId: "user-id-from-clerk",
//         gameId: "game-id-reference",
//         startTime: "timestamp",
//         isGuest: false
//       },
//       gameData: {
//         sessionId: "session-id-reference",
//         gameId: "game-id-reference",
//         userId: "user-id-reference",
//         roundNumber: 1,
//         roundData: {
//           score: 0,
//           actions: [],
//           completed: false
//         }
//       }
//     }
//   };
// }

// const htmlExample = `<!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Number Guessing Game</title>
//   <style>
//     body, html { 
//       margin: 0; 
//       padding: 0; 
//       font-family: Arial, sans-serif;
//       display: flex;
//       justify-content: center;
//       align-items: center;
//       height: 100vh;
//       background-color: #f0f0f0;
//     }
//     #game-container {
//       width: 80%;
//       max-width: 600px;
//       background: white;
//       padding: 20px;
//       border-radius: 8px;
//       box-shadow: 0 2px 10px rgba(0,0,0,0.1);
//       text-align: center;
//     }
//     button {
//       background-color: #4CAF50;
//       color: white;
//       border: none;
//       padding: 10px 15px;
//       font-size: 16px;
//       cursor: pointer;
//       border-radius: 4px;
//       margin-top: 10px;
//     }
//     input {
//       padding: 8px;
//       font-size: 16px;
//       border: 1px solid #ddd;
//       border-radius: 4px;
//       margin-right: 5px;
//     }
//   </style>
// </head>
// <body>
//   <div id="game-container">
//     <h1>Number Guessing Game</h1>
//     <p id="message">I'm thinking of a number between 1 and 100. Can you guess it?</p>
//     <div>
//       <input type="number" id="guess-input" min="1" max="100">
//       <button id="submit-btn">Submit</button>
//     </div>
//     <p id="attempts">Attempts: 0</p>
//   </div>
  
//   <script>
//     const messageElement = document.getElementById('message');
//     const guessInput = document.getElementById('guess-input');
//     const submitButton = document.getElementById('submit-btn');
//     const attemptsElement = document.getElementById('attempts');
    
//     let gameState = {
//       secretNumber: Math.floor(Math.random() * 100) + 1,
//       attempts: 0,
//       gameOver: false
//     };
    
//     submitButton.addEventListener('click', makeGuess);
    
//     function makeGuess() {
//       if (gameState.gameOver) return;
      
//       const guess = parseInt(guessInput.value);
      
//       if (isNaN(guess) || guess < 1 || guess > 100) {
//         messageElement.textContent = "Please enter a valid number between 1 and 100";
//         return;
//       }
      
//       gameState.attempts++;
//       attemptsElement.textContent = \`Attempts: \${gameState.attempts}\`;
      
//       if (guess === gameState.secretNumber) {
//         messageElement.textContent = \`Congratulations! You guessed the number \${gameState.secretNumber} in \${gameState.attempts} attempts!\`;
//         messageElement.style.color = "green";
//         gameState.gameOver = true;
        
//         const playAgainBtn = document.createElement('button');
//         playAgainBtn.textContent = "Play Again";
//         playAgainBtn.addEventListener('click', resetGame);
//         document.getElementById('game-container').appendChild(playAgainBtn);
//       } else if (guess < gameState.secretNumber) {
//         messageElement.textContent = "Too low! Try a higher number.";
//       } else {
//         messageElement.textContent = "Too high! Try a lower number.";
//       }
      
//       guessInput.value = "";
//       guessInput.focus();
//     }
    
//     function resetGame() {
//       gameState.secretNumber = Math.floor(Math.random() * 100) + 1;
//       gameState.attempts = 0;
//       gameState.gameOver = false;
      
//       messageElement.textContent = "I'm thinking of a new number between 1 and 100. Can you guess it?";
//       messageElement.style.color = "black";
//       attemptsElement.textContent = "Attempts: 0";
      
//       const playAgainBtn = document.querySelector('#game-container button:last-child');
//       if (playAgainBtn && playAgainBtn.textContent === "Play Again") {
//         playAgainBtn.remove();
//       }
//     }
//   </script>
// </body>
// </html>`;

// export async function POST(request: NextRequest) {
//   try {
//     const clerkUser = await currentUser(); // Added
//     if (!clerkUser) { // Added
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); // Added
//     } // Added

//     const { message, chatHistory, systemPrompt: customSystemPrompt } = await request.json();
    
//     // Check subscription and get appropriate model // Added
//     const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id); // Added
    
//     if (!canUseApi) { // Added
//       return NextResponse.json({  // Added
//         error: "Monthly API request limit reached. Please upgrade your plan for more requests.",  // Added
//         limitReached: true  // Added
//       }, { status: 403 }); // Added
//     } // Added
    
//     console.log("🔍 GameLab: Processing chat request with query:", message);
    
//     const gameCodeExamples = await fetchGameCode(message);
    
//     console.log("🔍 GameLab: Found code examples in database:", 
//       Object.keys(gameCodeExamples).length > 0 ? 
//       Object.keys(gameCodeExamples).join(", ") : 
//       "None");
    
//     if (Object.keys(gameCodeExamples).length > 0) {
//       console.log("🔍 GameLab: First example contains components:", 
//         gameCodeExamples[Object.keys(gameCodeExamples)[0]]?.componentExamples?.length || 0);
//     }
    
//     const templateStructure = getTemplateStructure();
    
//     console.log("🔍 GameLab: Sending prompt to AI with code examples:", 
//       Object.keys(gameCodeExamples).length > 0 ? "Yes" : "No");
    
//     const systemPrompt = customSystemPrompt || `
//     You are an AI game development assistant for RandomPlayables, a platform for mathematical citizen science games.
    
//     Your goal is to help users create games that can be deployed on the RandomPlayables platform. You have access to 
//     existing game examples and their codebases to guide your recommendations.
    
//     IMPORTANT REQUIREMENTS FOR ALL GAMES YOU CREATE:
    
//     1. Every game MUST be delivered as a COMPLETE single HTML file with:
//         - Proper DOCTYPE and HTML structure
//         - CSS in a <style> tag in the head
//         - JavaScript in a <script> tag before the body closing tag
//         - A <div id="game-container"></div> element that the JavaScript code interacts with
    
//     2. Interactive elements MUST use standard DOM event listeners, for example:
//         document.getElementById('button-id').addEventListener('click', handleClick);
    
//     3. All JavaScript code must reference elements by ID or create elements dynamically.
    
//     4. The game should work entirely in a sandbox environment without external dependencies.
    
//     REAL CODE EXAMPLES FROM EXISTING GAMES:
//     ${JSON.stringify(gameCodeExamples, null, 2)}
    
//     When designing games based on existing code examples:
//     1. Follow similar patterns for game structure and organization
//     2. Use the same approach for connecting to the RandomPlayables platform APIs
//     3. Implement similar data structures for game state and scoring
//     4. Import any necessary type definitions
    
//     When handling platform integration:
//     1. Every game should connect to the RandomPlayables platform using the provided API service patterns
//     2. Use sessionId to track game sessions
//     3. Send game data to the platform for scoring and analysis
    
//     Example of a complete game:
    
//     \`\`\`html
// ${htmlExample}
//     \`\`\`
    
//     Template structures for new games:
//     ${JSON.stringify(templateStructure, null, 2)}
    
//     MongoDB database structure for games:
//     - Games collection: Stores metadata about each game
//     - GameSessions collection: Tracks user play sessions
//     - GameData collection: Stores gameplay data for analysis
    
//     These games will be deployed on RandomPlayables.com as subdomains (e.g., gamename.randomplayables.com).
    
//     When responding:
//     1. First understand the user's game idea and ask clarifying questions if needed
//     2. Suggest a clear game structure and mechanics
//     3. Provide a COMPLETE self-contained HTML file with embedded CSS and JavaScript
//     4. Explain how the game would integrate with the RandomPlayables platform
//     `;
    
//     console.log("🔍 GameLab: Sending prompt to AI with code examples:", 
//       Object.keys(gameCodeExamples).length > 0 ? "Yes" : "No");
    
//     const messages = [
//       { role: "system", content: systemPrompt },
//       ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
//       { role: "user", content: message }
//     ];
    
//     const response = await openAI.chat.completions.create(
//       createModelRequest(model, messages as any, systemPrompt)
//     );

//     await incrementApiUsage(clerkUser.id); // Added
    
//     const aiResponse = response.choices[0].message.content!;
    
//     console.log("🔍 GameLab: Response type:", typeof aiResponse);

//     let code = "";
//     let language = "html";
//     let message_text: string; // Ensure message_text is explicitly typed as string

//     if (typeof aiResponse === 'string') {
//       console.log("🔍 GameLab: Received AI response of length:", aiResponse.length);
//       console.log("🔍 GameLab: Sample:", aiResponse.substring(0, 100));

//       // Initialize message_text with the raw string response, might be refined
//       message_text = aiResponse; 

//       const codeBlockRegex = /```([a-zA-Z0-9+#]+)?\n([\s\S]*?)```/g;
//       const codeBlocks: Array<[string, string, string]> = [];
//       let match;
//       while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
//         codeBlocks.push([match[0], match[1] || '', match[2]]);
//       }

//       if (codeBlocks.length > 0) {
//         const mainCodeBlock = codeBlocks.reduce((longest, current) => {
//           return current[2].length > longest[2].length ? current : longest;
//         }, codeBlocks[0]);
        
//         if (mainCodeBlock[1]) {
//           language = mainCodeBlock[1].toLowerCase();
//         }
        
//         code = mainCodeBlock[2].trim();
//         console.log("🔍 GameLab: Extracted code block of length:", code.length, "language:", language);
        
//         message_text = aiResponse.replace(/```[a-zA-Z0-9+#]*\n[\s\S]*?```/g, "").trim();
        
//         if (code.includes("<!DOCTYPE html>") || code.includes("<html")) {
//           const htmlMatch = code.match(/<html[\s\S]*?<\/html>/);
//           if (htmlMatch) {
//             code = htmlMatch[0];
//             console.log("🔍 GameLab: Found complete HTML in code block, length:", code.length);
//           }
//         }
//       } else { // No code blocks found in the string response
//         const htmlMatch = aiResponse.match(/<html[\s\S]*?<\/html>/);
//         if (htmlMatch) {
//           code = htmlMatch[0];
//           message_text = aiResponse.replace(htmlMatch[0], "").trim();
//           language = "html";
//           console.log("🔍 GameLab: Extracted HTML directly from response, length:", code.length);
//         } else {
//           const scriptMatch = aiResponse.match(/<script[\s\S]*?<\/script>/);
//           if (scriptMatch) {
//             code = `<!DOCTYPE html>
//     <html>
//     <head>
//       <title>Game</title>
//     </head>
//     <body>
//       <div id="game-container"></div>
//       ${scriptMatch[0]}
//     </body>
//     </html>`;
//             message_text = aiResponse.replace(scriptMatch[0], "").trim();
//             language = "html";
//             console.log("🔍 GameLab: Found script tag and wrapped in HTML, length:", code.length);
//           } else {
//             console.log("🔍 GameLab: No code blocks or HTML found in response, using full response as code");
//             // If no code blocks found, assume the entire response is code
//             code = aiResponse; // aiResponse is a string here
//             message_text = "Here's your game code:"; // Provide a generic message
//           }
//         }
//       }
//     } else { // aiResponse is not a string
//       console.log("🔍 GameLab: Received non-string response, handling as plain text");
//       if (aiResponse !== null && aiResponse !== undefined) {
//         console.log("🔍 GameLab: Sample:", JSON.stringify(aiResponse).substring(0, 100));
//         code = JSON.stringify(aiResponse);
//       } else {
//         console.log("🔍 GameLab: Sample: null or undefined");
//         code = "Error: AI response was null or undefined.";
//       }
//       message_text = "Received response in unexpected format. Please try again.";
//     }

//     console.log("🔍 GameLab: Final code length:", code.length);
//     console.log("🔍 GameLab: Final message length:", message_text.length);

//     return NextResponse.json({
//       message: message_text,
//       code: code,
//       language: language,
//       remainingRequests
//     });
    
//   } catch (error: any) {
//     console.error("Error in GameLab chat:", error);
//     return NextResponse.json(
//       { error: "Failed to generate game code", details: error.message },
//       { status: 500 }
//     );
//   }
// }

// File: app/api/gamelab/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";
import { 
    getTemplateStructure, 
    fetchGameCodeExamplesForQuery,
    // parseRepomixXml, // Not directly used here anymore, but used by fetchGameCodeExamplesForQuery
    // extractComponentsFromCode // Same as above
} from "./gamelabHelper"; // Import helpers

// Fallback system prompt template if frontend sends an empty one
// %%GAMELAB_TEMPLATE_STRUCTURES%% for Type A
// %%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%% for Type B
const FALLBACK_GAMELAB_SYSTEM_PROMPT_TEMPLATE = `
You are an AI game development assistant for RandomPlayables, a platform for mathematical citizen science games.
Your goal is to help users create games that can be deployed on the RandomPlayables platform.

IMPORTANT REQUIREMENTS FOR ALL GAMES YOU CREATE:
1. Every game MUST be delivered as a COMPLETE single HTML file with:
    - Proper DOCTYPE and HTML structure
    - CSS in a <style> tag in the head
    - JavaScript in a <script> tag before the body closing tag
    - A <div id="game-container"></div> element that the JavaScript code interacts with
2. Interactive elements MUST use standard DOM event listeners.
3. All JavaScript code must reference elements by ID or create elements dynamically.
4. The game should work entirely in a sandbox environment without external dependencies.

AVAILABLE TEMPLATE STRUCTURES (Type A data):
%%GAMELAB_TEMPLATE_STRUCTURES%%

REAL CODE EXAMPLES FROM EXISTING GAMES (Type B data, based on your query):
%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%

When designing games based on existing code examples (if provided based on your query):
1. Follow similar patterns for game structure and organization.
2. Implement similar data structures for game state and scoring.

Example of a complete, simple HTML game:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Simple Clicker Game</title>
  <style>
    body { display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background: #f0f0f0; }
    #game-container { text-align: center; }
    button { font-size: 20px; padding: 10px 20px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="game-container">
    <h1>Click the Button!</h1>
    <button id="clickerBtn">Click me: <span id="score">0</span></button>
  </div>
  <script>
    let score = 0;
    const scoreDisplay = document.getElementById('score');
    const clickerButton = document.getElementById('clickerBtn');
    clickerButton.addEventListener('click', () => {
      score++;
      scoreDisplay.textContent = score;
      if(window.sendDataToGameLab) {
        window.sendDataToGameLab({ event: 'click', currentScore: score, timestamp: new Date().toISOString() });
      }
    });
  <\/script>
</body>
</html>
\`\`\`
These games will be deployed on RandomPlayables.com.

When responding:
1. First understand the user's game idea. Ask clarifying questions if needed.
2. Suggest a clear game structure and mechanics.
3. Provide a COMPLETE self-contained HTML file with embedded CSS and JavaScript.
4. Explain how the game would integrate with the RandomPlayables platform if relevant.
5. Ensure your generated code uses the \`game-container\` div if it needs a root element.
`;


const htmlExample = `<!DOCTYPE html> 
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Number Guessing Game</title>
  <style>
    body, html { margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f0f0; }
    #game-container { width: 80%; max-width: 600px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
    button { background-color: #4CAF50; color: white; border: none; padding: 10px 15px; font-size: 16px; cursor: pointer; border-radius: 4px; margin-top: 10px; }
    input { padding: 8px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; margin-right: 5px; }
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
    const messageElement = document.getElementById('message');
    const guessInput = document.getElementById('guess-input');
    const submitButton = document.getElementById('submit-btn');
    const attemptsElement = document.getElementById('attempts');
    let gameState = { secretNumber: Math.floor(Math.random() * 100) + 1, attempts: 0, gameOver: false };
    submitButton.addEventListener('click', makeGuess);
    function makeGuess() {
      if (gameState.gameOver) return;
      const guess = parseInt(guessInput.value);
      if (isNaN(guess) || guess < 1 || guess > 100) { messageElement.textContent = "Please enter a valid number between 1 and 100"; return; }
      gameState.attempts++;
      attemptsElement.textContent = \`Attempts: \${gameState.attempts}\`;
      if (guess === gameState.secretNumber) {
        messageElement.textContent = \`Congratulations! You guessed the number \${gameState.secretNumber} in \${gameState.attempts} attempts!\`;
        messageElement.style.color = "green"; gameState.gameOver = true;
        const playAgainBtn = document.createElement('button'); playAgainBtn.textContent = "Play Again";
        playAgainBtn.addEventListener('click', resetGame); document.getElementById('game-container').appendChild(playAgainBtn);
      } else if (guess < gameState.secretNumber) { messageElement.textContent = "Too low! Try a higher number.";
      } else { messageElement.textContent = "Too high! Try a lower number."; }
      guessInput.value = ""; guessInput.focus();
    }
    function resetGame() {
      gameState.secretNumber = Math.floor(Math.random() * 100) + 1; gameState.attempts = 0; gameState.gameOver = false;
      messageElement.textContent = "I'm thinking of a new number between 1 and 100. Can you guess it?";
      messageElement.style.color = "black"; attemptsElement.textContent = "Attempts: 0";
      const playAgainBtn = document.querySelector('#game-container button:last-child');
      if (playAgainBtn && playAgainBtn.textContent === "Play Again") { playAgainBtn.remove(); }
    }
  <\/script>
</body>
</html>`;


const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

function createModelRequest(model: string, messages: any[]) {
  return {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: model.includes('o4-mini') ? 4000 : 2000,
  };
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `customSystemPrompt` is the user-edited prompt from the frontend.
    // It should have Type A placeholders (template structures) already resolved.
    const { message: userQuery, chatHistory, customSystemPrompt } = await request.json();
    
    const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id);
    
    if (!canUseApi) {
      return NextResponse.json({ 
        error: "Monthly API request limit reached. Please upgrade your plan.", 
        limitReached: true 
      }, { status: 403 });
    }
    
    // Fetch Type B data: query-specific game code examples
    const querySpecificGameCodeExamples = await fetchGameCodeExamplesForQuery(userQuery);
    const gameCodeExamplesString = Object.keys(querySpecificGameCodeExamples).length > 0
        ? JSON.stringify(querySpecificGameCodeExamples, null, 2)
        : "No specific game code examples match the query. Generic examples or templates may be used by the AI.";


    let finalSystemPrompt: string;

    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      // Use the prompt from the frontend. Type A (template structures) should already be resolved.
      // Now, resolve Type B placeholder (query-specific code examples).
      finalSystemPrompt = customSystemPrompt.replace(
        '%%GAMELAB_QUERY_SPECIFIC_CODE_EXAMPLES%%',
        gameCodeExamplesString
      );

      // Safety net: If Type A placeholder (template structures) is still there, resolve it.
      // This should ideally be handled by the frontend.
      if (finalSystemPrompt.includes('%%GAMELAB_TEMPLATE_STRUCTURES%%')) {
        console.warn("GameLab Chat API: Frontend-provided system prompt still contains %%GAMELAB_TEMPLATE_STRUCTURES%%. Resolving now.");
        const templateStructure = getTemplateStructure(); // Fetch Type A data
        finalSystemPrompt = finalSystemPrompt.replace(
          '%%GAMELAB_TEMPLATE_STRUCTURES%%',
          JSON.stringify(templateStructure, null, 2)
        );
      }
    } else {
      // Frontend sent no custom prompt, use backend's fallback template
      console.log("GameLab Chat API: No customSystemPrompt from frontend, using fallback.");
      const templateStructure = getTemplateStructure(); // Fetch Type A data
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
    let language = "html"; // Default language
    let message_text = aiResponseContent;

    // Enhanced code extraction logic (from original file)
    const codeBlockRegex = /```([a-zA-Z0-9+#]+)?\n([\s\S]*?)```/g;
    const codeBlocks: Array<[string, string, string]> = [];
    let match;
    while ((match = codeBlockRegex.exec(aiResponseContent)) !== null) {
        codeBlocks.push([match[0], match[1] || '', match[2]]);
    }

    if (codeBlocks.length > 0) {
        const mainCodeBlock = codeBlocks.reduce((longest, current) => current[2].length > longest[2].length ? current : longest, codeBlocks[0]);
        language = mainCodeBlock[1].toLowerCase() || 'html'; // Set language from block if present
        code = mainCodeBlock[2].trim();
        message_text = aiResponseContent.replace(codeBlockRegex, "").trim(); // Remove all code blocks from text

        // Ensure full HTML document structure if HTML code is provided
        if (language === 'html' && !(code.toLowerCase().includes('<!doctype html>') || code.toLowerCase().includes('<html'))) {
             // Heuristic: if it looks like a substantial HTML snippet but not a full doc
            if (code.includes("<body") || code.includes("<div") || code.includes("<script")) {
                 code = htmlExample.replace(/<script>[\s\S]*?<\/script>/, `<script>${code}</script>`) // crude wrap
                                  .replace(/<h1>.*?<\/h1>/, `<h1>Generated Game</h1>`)
                                  .replace(/<title>.*?<\/title>/, `<title>Generated Game</title>`);
            }
        }


    } else { // No ```code blocks``` found
        const htmlMatch = aiResponseContent.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
        if (htmlMatch) {
            code = htmlMatch[0];
            message_text = aiResponseContent.replace(htmlMatch[0], "").trim();
            language = "html";
        } else {
            // If still no specific code, and the response is short, it might be just a message.
            // If it's long, it might be code without markdown. This part is heuristic.
            if (aiResponseContent.length < 200 && !aiResponseContent.match(/<[^>]+>/)) { // Likely just a message
                code = ""; // No code
                message_text = aiResponseContent;
            } else { // Assume it's code, default to HTML
                code = aiResponseContent;
                language = "html";
                 // Try to wrap if it's not a full HTML doc
                if (!(code.toLowerCase().includes('<!doctype html>') || code.toLowerCase().includes('<html'))) {
                    if (code.includes("<body") || code.includes("<div") || code.includes("<script")) {
                        code = htmlExample.replace(/<script>[\s\S]*?<\/script>/, `<script>${code}</script>`)
                                          .replace(/<h1>.*?<\/h1>/, `<h1>Generated Game</h1>`)
                                          .replace(/<title>.*?<\/title>/, `<title>Generated Game</title>`);
                    }
                }
                message_text = "Here's the game code I generated for you:";
            }
        }
    }

    return NextResponse.json({
      message: message_text,
      code: code,
      language: language,
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