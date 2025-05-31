// File: app/api/gamelab/chat/gamelabHelper.ts
import mongoose from "mongoose";
import { connectToDatabase as connectToMainDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import CodeBaseModel from "@/models/CodeBase";

export function getTemplateStructure() {
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
    mongodb: { // This seems more like a data structure example than a game template
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

export function parseRepomixXml(xmlContent: string): {
  packageJson: any | null;
  components: Array<{ name: string; content: string }>;
  services: Array<{ name: string; content: string }>;
  types: Array<{ name: string; content: string }>;
} {
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
    const packageJsonMatch = xmlContent.match(/<file path="package\.json">([\s\S]*?)<\/file>/);
    if (packageJsonMatch && packageJsonMatch[1]) {
      try {
        result.packageJson = JSON.parse(packageJsonMatch[1]);
      } catch (e) {
        console.warn("Could not parse package.json from Repomix XML:", e);
      }
    }
    
    const fileMatches = xmlContent.match(/<file path="[^"]+">([\s\S]*?)<\/file>/g) || [];
    
    for (const fileMatch of fileMatches) {
      const pathMatch = fileMatch.match(/<file path="([^"]+)">/);
      if (pathMatch && pathMatch[1]) {
        const path = pathMatch[1];
        // Ensure content is correctly extracted between the tags
        const contentMatch = fileMatch.match(/<file path="[^"]+">([\s\S]*?)<\/file>/);
        const content = contentMatch && contentMatch[1] ? contentMatch[1].trim() : '';
        
        if (path.includes('/components/') || path.endsWith('.jsx') || path.endsWith('.tsx')) {
          result.components.push({ name: path, content });
        } else if (path.includes('/services/') || path.includes('/api/')) {
          result.services.push({ name: path, content });
        } else if (path.includes('/types/') || path.includes('.d.ts')) {
          result.types.push({ name: path, content });
        }
      }
    }
  } catch (error) {
    console.error("Error parsing Repomix XML in gamelabHelper:", error);
  }
  return result;
}

export function extractComponentsFromCode(codeContent: string): Array<{ name: string; content: string }> {
  const components: Array<{ name: string; content: string }> = [];
  // Refined regex to better capture various function/class definitions
  const componentRegex = /(?:class|function|const)\s+([A-Z]\w*)[^=]*=\s*(?:class\s*\w+\s*extends\s*React\.Component|function\s*\w*\s*\(|\(\s*\)\s*=>\s*{|\(\s*[\w,\s]*\s*\)\s*=>\s*{|Component)/g;
  let match;

  while ((match = componentRegex.exec(codeContent)) !== null) {
    const componentName = match[1];
    const startIndex = match.index;
    if (startIndex === undefined) continue;

    let braceCount = 0;
    let endIndex = -1;
    let firstBraceIndex = -1;

    // Find the start of the component body (e.g., after `=> {` or `() {`)
    const bodyStartIndex = codeContent.indexOf('{', startIndex + match[0].length -1 ); // Look for '{' after the declaration
    if (bodyStartIndex === -1) continue; // No block found

    firstBraceIndex = bodyStartIndex;
    braceCount = 1;

    for (let i = firstBraceIndex + 1; i < codeContent.length; i++) {
      if (codeContent[i] === '{') braceCount++;
      if (codeContent[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    if (endIndex !== -1) {
      const componentCode = codeContent.substring(startIndex, endIndex).trim();
      if (componentCode) {
        components.push({
          name: componentName,
          content: componentCode
        });
      }
    }
  }
  return components;
}


// This function is for Type B data (query-specific)
export async function fetchGameCodeExamplesForQuery(query: string) {
  try {
    await connectToMainDatabase();
    
    const allGames = await GameModel.find({}).lean();
    let selectedGames = [];
    
    const mentionedGames = allGames.filter(game => 
      game.name && query.toLowerCase().includes(game.name.toLowerCase())
    );
    
    if (mentionedGames.length > 0) {
      selectedGames = mentionedGames;
    } else {
      // Fallback: if no specific games mentioned, select a few (e.g., first 3)
      // This behavior might need adjustment based on desired default context for GameLab
      selectedGames = allGames.slice(0, 1); // Limit to 1 for less verbose default prompt
    }
    
    const gameCodeContext: Record<string, any> = {};
    
    for (const game of selectedGames) {
      if (!game.id) continue;
      const codebase = await CodeBaseModel.findOne({ gameId: game.id }).lean();
      
      if (codebase) {
        if (codebase.contentType === "repomix-xml") {
          const parsedCode = parseRepomixXml(codebase.codeContent);
          gameCodeContext[game.name] = {
            id: game.id,
            name: game.name,
            packageJson: parsedCode.packageJson,
            componentExamples: parsedCode.components.slice(0, 2), // Limit examples
          };
        } else { // "source-code"
          const components = extractComponentsFromCode(codebase.codeContent);
          gameCodeContext[game.name] = {
            id: game.id,
            name: game.name,
            componentExamples: components.slice(0, 2), // Limit examples
          };
        }
      }
    }
    return gameCodeContext;
  } catch (error) {
    console.error("GameLab Helper: Error fetching game code examples:", error);
    return {}; // Return empty object on error
  }
}

// Example of fetching general game information (Type A) - if needed
// For now, context-data only provides templateStructure.
export async function fetchGeneralGameLabContext() {
  // Example: fetch a list of all game names or popular game archetypes
  // await connectToMainDatabase();
  // const games = await GameModel.find({}, { name: 1, description: 1, _id: 0 }).limit(5).lean();
  // return { availableGameTemplates: games };
  return {}; // Placeholder if only templateStructure is needed for Type A
}