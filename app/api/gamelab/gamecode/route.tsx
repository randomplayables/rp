// app/api/gamelab/gamecode/route.tsx
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import CodeBaseModel from "@/models/CodeBase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const gameName = searchParams.get("name");
    
    await connectToDatabase();
    
    // Find the game by ID or name
    let game;
    if (gameId) {
      const numericId = parseInt(gameId);
      if (!isNaN(numericId)) {
        game = await GameModel.findOne({ id: numericId }).lean();
      }
    } else if (gameName) {
      game = await GameModel.findOne({ 
        name: { $regex: new RegExp(gameName, "i") } 
      }).lean();
    }
    
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    
    // Find codebase for this game
    const codebase = await CodeBaseModel.findOne({ gameId: game.id }).lean();
    
    if (!codebase) {
      return NextResponse.json({ 
        error: "No codebase found for this game",
        game: {
          id: game.id,
          name: game.name
        }
      }, { status: 404 });
    }
    
    // Parse the codebase based on contentType
    let parsedCodebase;
    if (codebase.contentType === "repomix-xml") {
      parsedCodebase = parseRepomixXml(codebase.codeContent, game.name);
    } else {
      // Simple format with direct code content
      parsedCodebase = {
        game: {
          id: game.id,
          name: game.name,
        },
        fullCode: codebase.codeContent,
        // Parse into components, services, types as needed
        components: extractComponents(codebase.codeContent),
        services: extractServices(codebase.codeContent),
        types: extractTypes(codebase.codeContent)
      };
    }
    
    return NextResponse.json({ gameCode: parsedCodebase });
  } catch (error: any) {
    console.error("Error fetching game code:", error);
    return NextResponse.json({ 
      error: "Failed to fetch game code", 
      details: error.message 
    }, { status: 500 });
  }
}

// Helper function to parse Repomix XML format
function parseRepomixXml(xmlContent: string, gameName: string) {
  // Implement XML parsing here
  // Extract code components from the XML structure
  
  // For demonstration, returning a simplified structure
  return {
    game: {
      name: gameName
    },
    components: [], // Extract component files
    services: [],   // Extract service files
    types: []       // Extract type definitions
  };
}

// Helper functions to extract code sections
function extractComponents(codeContent: string) {
  // Parse the code content to extract components
  // You can use regex or more sophisticated parsing
  return [];
}

function extractServices(codeContent: string) {
  // Parse the code content to extract services
  return [];
}

function extractTypes(codeContent: string) {
  // Parse the code content to extract type definitions
  return [];
}