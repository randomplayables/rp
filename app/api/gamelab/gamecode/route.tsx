import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { checkRateLimit, getGameCode } from "@/lib/githubApi";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const gameName = searchParams.get("name");
    
    await connectToDatabase();
    
    // Check the remaining GitHub API rate limit
    const rateLimit = await checkRateLimit();
    
    if (rateLimit && rateLimit.remaining < 10) {
      return NextResponse.json({
        error: "GitHub API rate limit nearly exhausted",
        rateLimit,
        cachedOnly: true
      }, { status: 429 });
    }
    
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
    
    // Check if game has a codeUrl
    if (!game.codeUrl) {
      return NextResponse.json({ 
        error: "Game doesn't have a GitHub repository URL",
        game: {
          id: game.id,
          name: game.name
        }
      }, { status: 404 });
    }
    
    // Get code from GitHub using only the codeUrl
    const gameCode = await getGameCode(game);
    
    if (!gameCode) {
      return NextResponse.json({ 
        error: "Failed to extract repository information from codeUrl",
        game: {
          id: game.id,
          name: game.name,
          codeUrl: game.codeUrl
        }
      }, { status: 404 });
    }
    
    return NextResponse.json({ gameCode });
  } catch (error: any) {
    console.error("Error fetching game code:", error);
    return NextResponse.json({ 
      error: "Failed to fetch game code", 
      details: error.message 
    }, { status: 500 });
  }
}