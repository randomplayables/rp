import mongoose from "mongoose";
import { connectToDatabase as connectToMainDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
import GameModel from "@/models/Game";
import CodeBaseModel from "@/models/CodeBase";

export function getTemplateStructure() {
  return {
    'react-typescript-sketch': {
      description: "A single App.tsx file for a React and TypeScript sketch. Suitable for GameLab's sandbox.",
      files: [
        {
          name: "App.tsx",
          content: `import React, { useState, useEffect } from 'react';

// Basic styles can be included here or as a separate App.css suggestion
const styles = \`
.App {
  text-align: center;
  font-family: Arial, sans-serif;
  padding: 20px;
  background-color: #f0f0f0;
  border-radius: 8px;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.game-title {
  color: #10B981; /* emerald-500 */
}

.counter-button {
  background-color: #10B981; /* emerald-500 */
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 15px;
}

.counter-button:hover {
  background-color: #059669; /* emerald-600 */
}

#game-specific-container {
    width: 100%;
    height: 200px;
    border: 1px dashed #ccc;
    margin-top: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}
\`;

const App: React.FC = () => {
  const [count, setCount] = useState<number>(0);
  const [message, setMessage] = useState<string>("React + TypeScript Game Sketch");

  // Example of interacting with GameLab Sandbox (if applicable)
  useEffect(() => {
    // Ensure window.sendDataToGameLab is available before calling it
    if (typeof window.sendDataToGameLab === 'function') {
      window.sendDataToGameLab({ event: 'sketch_loaded', initialCount: 0, timestamp: new Date().toISOString() });
    }
    console.log("React Sketch Loaded in GameLab Sandbox. GAMELAB_SESSION_ID:", window.GAMELAB_SESSION_ID);
  }, []);

  const increment = () => {
    const newCount = count + 1;
    setCount(newCount);
    if (typeof window.sendDataToGameLab === 'function') {
      window.sendDataToGameLab({ event: 'increment', newCount, timestamp: new Date().toISOString() });
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="App">
        <h1 className="game-title">{message}</h1>
        <p>Current count: {count}</p>
        <button onClick={increment} className="counter-button">
          Increment
        </button>
        <div id="game-specific-container">
            <p>Your game elements can go here.</p>
        </div>
      </div>
    </>
  );
};

// If GameSandbox expects a default export:
// export default App;
// The current GameSandbox (GameSandbox.tsx) tries to find 'App' and render it into '#root'.
// So, defining 'App' as a const and potentially not exporting it as default is fine
// as long as GameSandbox's ReactDOM.createRoot(document.getElementById('root')).render(<App />); works.
// Making it a default export or ensuring it is explicitly rendered might be more robust.
// For now, the existing sandbox logic for <App /> should pick this up.
`
        },
        // You could add a placeholder for App.css if you prefer separate CSS files,
        // but for sketches, inline <style> or CSS-in-JS might be simpler for the AI.
      ]
    },
    // Keep the mongodb example as it's for data structure, not a game template
    mongodb: {
      gameStructure: {
        gameId: "unique-game-id-slug",
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
  const componentRegex = /(?:class|function|const)\s+([A-Z]\w*)[^=]*=\s*(?:class\s*\w+\s*extends\s*React\.Component|function\s*\w*\s*\(|\(\s*\)\s*=>\s*{|\(\s*[\w,\s]*\s*\)\s*=>\s*{|Component)/g;
  let match;

  while ((match = componentRegex.exec(codeContent)) !== null) {
    const componentName = match[1];
    const startIndex = match.index;
    if (startIndex === undefined) continue;

    let braceCount = 0;
    let endIndex = -1;
    let firstBraceIndex = -1;

    const bodyStartIndex = codeContent.indexOf('{', startIndex + match[0].length -1 );
    if (bodyStartIndex === -1) continue;

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

export async function fetchGameCodeExamplesForQuery(query: string) {
  console.log(`[GameLab Helper] INFO: Attempting to fetch game code examples for query: "${query}"`);
  try {
    await connectToMainDatabase();
    console.log("[GameLab Helper] INFO: Successfully connected to MongoDB.");

    const allGames = await GameModel.find({}).lean();
    let selectedGames = [];

    const mentionedGames = allGames.filter(game =>
      game.name && query.toLowerCase().includes(game.name.toLowerCase())
    );

    if (mentionedGames.length > 0) {
      selectedGames = mentionedGames;
      console.log(`[GameLab Helper] INFO: Found ${mentionedGames.length} game(s) mentioned in query: ${mentionedGames.map(g => g.name).join(', ')}`);
    } else {
      selectedGames = allGames.slice(0, 1); // Default to one example if no specific game is mentioned
      if (selectedGames.length > 0) {
        console.log(`[GameLab Helper] INFO: No specific games mentioned in query. Selecting a default example game: ${selectedGames[0].name}`);
      } else {
        console.log("[GameLab Helper] WARNING: No games found in the database to select as an example.");
        return {};
      }
    }

    const gameCodeContext: Record<string, any> = {};

    for (const game of selectedGames) {
      if (!game.gameId) {
        console.log(`[GameLab Helper] WARNING: Game "${game.name}" has no gameId, skipping codebase fetch.`);
        continue;
      }
      console.log(`[GameLab Helper] INFO: Accessing CodeBaseModel for game: "${game.name}" (ID: ${game.gameId})`);
      const codebase = await CodeBaseModel.findOne({ gameId: game.gameId }).lean();

      if (codebase) {
        console.log(`[GameLab Helper] SUCCESS: Found codebase for game "${game.name}". ContentType: "${codebase.contentType}".`);
        let gameDataToStore: any = {
            gameId: game.gameId,
            name: game.name,
            description: game.description,
        };

        if (codebase.contentType === "repomix-xml") {
          const parsedCode = parseRepomixXml(codebase.codeContent);
          gameDataToStore.packageJson = parsedCode.packageJson ? 'Available' : 'Not Available';
          gameDataToStore.componentExamples = parsedCode.components.slice(0, 2).map(c => ({ name: c.name, contentPreview: c.content.substring(0, 50) + '...' }));
          console.log(`[GameLab Helper] USAGE: Parsed Repomix XML for "${game.name}". Extracted ${parsedCode.components.length} components (showing up to 2 previews).`);
        } else { 
          const components = extractComponentsFromCode(codebase.codeContent);
          gameDataToStore.componentExamples = components.slice(0, 2).map(c => ({ name: c.name, contentPreview: c.content.substring(0, 50) + '...' }));
          console.log(`[GameLab Helper] USAGE: Extracted components from source code for "${game.name}". Found ${components.length} components (showing up to 2 previews).`);
        }
        gameCodeContext[game.name] = gameDataToStore;
      } else {
        console.log(`[GameLab Helper] WARNING: No codebase found in CodeBaseModel for game "${game.name}".`);
      }
    }
    
    if (Object.keys(gameCodeContext).length > 0) {
        console.log(`[GameLab Helper] SUCCESS: Prepared game code context for AI with keys: ${Object.keys(gameCodeContext).join(', ')}`);
    } else {
        console.log("[GameLab Helper] INFO: No game code examples could be prepared for the AI for this query.");
    }
    return gameCodeContext;
  } catch (error) {
    console.error("[GameLab Helper] ERROR: Error fetching game code examples:", error);
    return {};
  }
}

export async function fetchGeneralGameLabContext() {
  return {};
}

export async function fetchMainGameExample(): Promise<string | null> {
    console.log(`[GameLab Helper] INFO: Attempting to fetch main game example for RPTS prompt context.`);
    try {
      await connectToMainDatabase();
      console.log("[GameLab Helper] INFO: Connected to MongoDB for fetching game example.");
  
      const game = await GameModel.findOne({ gameId: 'gotham-loops' }).lean();
      if (!game) {
        console.warn(`[GameLab Helper] WARNING: Example game with gameId 'gotham-loops' not found in Games collection.`);
        return null;
      }
  
      if (!game.gameId) {
        console.warn(`[GameLab Helper] WARNING: Game "${game.name}" has no gameId, skipping codebase fetch.`);
        return null;
      }
  
      const codebase = await CodeBaseModel.findOne({ gameId: game.gameId }).lean();
      if (!codebase) {
        console.warn(`[GameLab Helper] WARNING: No codebase found for gameId: ${game.gameId} (${game.name})`);
        return null;
      }
      
      console.log(`[GameLab Helper] SUCCESS: Found codebase for game "${game.name}".`);
      return codebase.codeContent;
  
    } catch (error) {
      console.error(`[GameLab Helper] ERROR: Error fetching main game example for "gotham-loops":`, error);
      return null;
    }
}