import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, roundNumber, roundData } = await request.json();
    
    if (!sessionId || roundNumber === undefined || !roundData) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Verify the session exists
    const session = await GameSessionModel.findOne({ sessionId });
    if (!session) {
      return NextResponse.json({ error: "Invalid session." }, { status: 404 });
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
    });
  } catch (error: any) {
    console.error("Error saving game data:", error);
    return NextResponse.json({ error: "Internal Error." }, { status: 500 });
  }
}

// GET endpoint to retrieve game data (optional but useful)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }
    
    await connectToDatabase();
    const gameData = await GameDataModel.find({ sessionId }).sort({ timestamp: 1 });
    
    return NextResponse.json({ gameData });
  } catch (error: any) {
    console.error("Error retrieving game data:", error);
    return NextResponse.json({ error: "Internal Error." }, { status: 500 });
  }
}