import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import CodeBaseModel from "@/models/CodeBase";
import { IGame } from "@/types/Game"; // Ensure IGame is correctly typed and imported
import mongoose from "mongoose"; // Import mongoose if needed for IGame & mongoose.Document

// --- Start: Functions adapted from app/api/gamelab/chat/route.ts or newly created ---

/**
 * Parses detailed Repomix XML content.
 * Adapted from app/api/gamelab/chat/route.ts.
 */
function parseRepomixXml_detailed(xmlContent: string): {
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
        result.packageJson = JSON.parse(packageJsonMatch[1].trim());
      } catch (e) {
        console.warn("Could not parse package.json from Repomix XML:", e);
      }
    }
    
    const fileMatches = xmlContent.match(/<file path="[^"]+">[\s\S]*?<\/file>/g) || [];
    
    for (const fileMatch of fileMatches) {
      const pathMatch = fileMatch.match(/<file path="([^"]+)">/);
      if (pathMatch && pathMatch[1]) {
        const path = pathMatch[1];
        const contentMatch = fileMatch.match(/<file path="[^"]+">([\s\S]*?)<\/file>/);
        const content = contentMatch && contentMatch[1] ? contentMatch[1].trim() : '';
        
        if (path.includes('/components/') || path.endsWith('.jsx') || path.endsWith('.tsx')) {
          result.components.push({ name: path, content: content });
        } else if (path.includes('/services/') || path.includes('/api/')) {
          result.services.push({ name: path, content: content });
        } else if (path.includes('/types/') || path.includes('.d.ts')) {
          result.types.push({ name: path, content: content });
        }
      }
    }
  } catch (error) {
    console.error("Error parsing Repomix XML in gamecode route:", error);
  }
  
  return result;
}

/**
 * Extracts component-like structures from a raw code string.
 * Adapted from app/api/gamelab/chat/route.ts.
 */
function extractComponentsFromSource(codeContent: string): Array<{ name: string; content: string }> {
  const components: Array<{ name: string; content: string }> = [];
  // Regex to find function/class/const declarations that might be components (PascalCase names)
  const componentMatches = codeContent.matchAll(/(?:class|function|const)\s+([A-Z]\w*)/g);
  
  for (const match of componentMatches) {
    const componentName = match[1];
    const startIndex = match.index !== undefined ? match.index : -1;
    
    if (startIndex === -1 || !match[0]) continue;

    let openBraces = 0;
    let endIndex = startIndex + match[0].length; // Start searching for block from end of declaration
    let firstBraceFound = false;
    let endOfBlock = -1;

    // Try to find a block scope {} or end of statement ;
    for (let i = endIndex; i < codeContent.length; i++) {
        if (codeContent[i] === '{') {
            if (!firstBraceFound) firstBraceFound = true;
            openBraces++;
        } else if (codeContent[i] === '}') {
            openBraces--;
            if (firstBraceFound && openBraces === 0) {
                endOfBlock = i + 1;
                break;
            }
        } else if (codeContent[i] === ';' && !firstBraceFound) { // End of const/simple function without block
            endOfBlock = i + 1;
            break;
        }
    }

    if (endOfBlock === -1) { // If no clear end found (e.g. end of file)
        endOfBlock = codeContent.length;
    }
    
    const componentCode = codeContent.substring(startIndex, endOfBlock).trim();
    
    if (componentCode) {
        components.push({
            name: componentName, // This is the component name
            // path: componentName, // For consistency, if needed, though path is less relevant for inline components
            content: componentCode
        });
    }
  }
  
  // If no components were found by regex, consider the whole file content as one component
  if (components.length === 0 && codeContent.trim().length > 0) {
      components.push({
          name: "MainGameLogic", // Generic name
          content: codeContent
      });
  }

  return components;
}

/**
 * Helper function to extract repository details from a GitHub URL.
 */
function extractRepoDetailsFromUrl(url?: string): { owner: string; name: string; url: string } | {} {
    if (!url || !url.includes('github.com')) {
        return {};
    }
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
            const owner = pathParts[0];
            const repoName = pathParts[1];
            return { owner, name: repoName, url };
        }
    } catch (e) {
        console.error("Error parsing repo URL for gamecode route:", e);
    }
    return {};
}

/**
 * For "source-code" contentType, it's hard to generically extract distinct services
 * from a single file dump. Returns an empty array.
 */
function extractServicesFromSource(codeContent: string): Array<{ name: string; content: string }> {
  return [];
}

/**
 * For "source-code" contentType, it's hard to generically extract distinct type definitions
 * from a single file dump. Returns an empty array.
 */
function extractTypesFromSource(codeContent: string): Array<{ name: string; content: string }> {
  return [];
}

// --- End: Adapted/New Functions ---


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameIdParam = searchParams.get("gameId");
    const gameNameParam = searchParams.get("name");
    
    await connectToDatabase();
    
    let game: (IGame & mongoose.Document) | null = null; // Define game type
    if (gameIdParam) {
      const numericId = parseInt(gameIdParam);
      if (!isNaN(numericId)) {
        game = await GameModel.findOne({ id: numericId }).lean();
      }
    } else if (gameNameParam) {
      game = await GameModel.findOne({ 
        name: { $regex: new RegExp(gameNameParam, "i") } 
      }).lean();
    }
    
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    
    const codebase = await CodeBaseModel.findOne({ gameId: game.id }).lean();
    
    if (!codebase) {
      return NextResponse.json({ 
        error: "No codebase found for this game",
        game: { id: game.id, name: game.name }
      }, { status: 404 });
    }
    
    let parsedCodebase;
    const repoDetails = extractRepoDetailsFromUrl(game.codeUrl);

    if (codebase.contentType === "repomix-xml") {
      const parsedContent = parseRepomixXml_detailed(codebase.codeContent);
      parsedCodebase = {
        game: { id: game.id, name: game.name },
        repo: repoDetails,
        structure: null, // The explorer page does not currently use gameCode.structure
        packageJson: parsedContent.packageJson,
        components: parsedContent.components,
        services: parsedContent.services,
        types: parsedContent.types,
      };
    } else { // Assumed "source-code" or other direct content
      parsedCodebase = {
        game: { id: game.id, name: game.name },
        repo: repoDetails,
        structure: null,
        packageJson: null, // Single source file unlikely to have separate package.json
        components: extractComponentsFromSource(codebase.codeContent),
        services: extractServicesFromSource(codebase.codeContent), // Returns []
        types: extractTypesFromSource(codebase.codeContent)        // Returns []
      };
    }
    
    return NextResponse.json({ gameCode: parsedCodebase });
  } catch (error: any) {
    console.error("Error fetching game code in gamecode route:", error);
    return NextResponse.json({ 
      error: "Failed to fetch game code", 
      details: error.message 
    }, { status: 500 });
  }
}