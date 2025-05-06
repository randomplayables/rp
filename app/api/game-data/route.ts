import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";

// Define CORS headers once to reuse
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Add this OPTIONS handler for preflight requests
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    status: 200,
    headers: corsHeaders
  });
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, roundNumber, roundData } = await request.json();
    
    if (!sessionId || roundNumber === undefined || !roundData) {
      return NextResponse.json({ error: "Missing required fields." }, { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    await connectToDatabase();
    
    // Verify the session exists
    const session = await GameSessionModel.findOne({ sessionId });
    if (!session) {
      return NextResponse.json({ error: "Invalid session." }, { 
        status: 404,
        headers: corsHeaders
      });
    }
    
    // Create game data entry
    const gameData = await GameDataModel.create({
      sessionId,
      gameId: session.gameId,
      userId: session.userId,
      isGuest: session.isGuest,
      roundNumber,
      roundData
    });
    
    return NextResponse.json({ 
      success: true,
      dataId: gameData._id
    }, {
      headers: corsHeaders
    });
  } catch (error: any) {
    console.error("Error saving game data:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}

// GET endpoint to retrieve game data with CORS headers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    await connectToDatabase();
    const gameData = await GameDataModel.find({ sessionId }).sort({ timestamp: 1 });
    
    return NextResponse.json({ gameData }, {
      headers: corsHeaders
    });
  } catch (error: any) {
    console.error("Error retrieving game data:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}