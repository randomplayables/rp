import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
import { allowedOrigins } from "../../../lib/corsConfig";

// Define dynamicCorsHeaders function to set origin based on request
function getDynamicCorsHeaders(request: NextRequest) {
  // Get the origin from the request
  const origin = request.headers.get('origin');
  
  let headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
  
  // If the origin is in our allowed list, set it specifically
  if (origin && allowedOrigins.includes(origin)) {
    return {
      ...headers,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true'
    };
  } else {
    // For other origins, use a wildcard (but credentials won't work)
    return {
      ...headers,
      'Access-Control-Allow-Origin': '*'
    };
  }
}

// Add this OPTIONS handler for preflight requests
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    status: 200,
    headers: getDynamicCorsHeaders(request)
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, roundNumber, roundData, passedUserId } = body;
    
    if (!sessionId || roundNumber === undefined || !roundData) {
      return NextResponse.json({ error: "Missing required fields." }, { 
        status: 400,
        headers: getDynamicCorsHeaders(request)
      });
    }
    
    await connectToDatabase();
    
    // Verify the session exists
    const session = await GameSessionModel.findOne({ sessionId });
    if (!session) {
      return NextResponse.json({ error: "Invalid session." }, { 
        status: 404,
        headers: getDynamicCorsHeaders(request)
      });
    }
    
    // If passedUserId is provided and session has no userId, update it
    let userId = session.userId;
    let isGuest = session.isGuest;
    
    if (!userId && passedUserId) {
      userId = passedUserId;
      isGuest = false;
      
      // Update the session with the user ID
      await GameSessionModel.updateOne(
        { sessionId },
        { $set: { userId: passedUserId, isGuest: false } }
      );
      
      console.log("Updated session with userId from request:", passedUserId);
    }
    
    // Log for debugging
    console.log("Saving data for session:", {
      sessionId,
      userId,
      isGuest,
      gameId: session.gameId
    });
    
    // Create game data entry
    const gameData = await GameDataModel.create({
      sessionId,
      gameId: session.gameId,
      userId,
      isGuest,
      roundNumber,
      roundData
    });
    
    return NextResponse.json({ 
      success: true,
      dataId: gameData._id
    }, {
      headers: getDynamicCorsHeaders(request)
    });
  } catch (error: any) {
    console.error("Error saving game data:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: getDynamicCorsHeaders(request)
    });
  }
}

// GET endpoint to retrieve game data with dynamic CORS headers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { 
        status: 400,
        headers: getDynamicCorsHeaders(request)
      });
    }
    
    await connectToDatabase();
    const gameData = await GameDataModel.find({ sessionId }).sort({ timestamp: 1 });
    
    return NextResponse.json({ gameData }, {
      headers: getDynamicCorsHeaders(request)
    });
  } catch (error: any) {
    console.error("Error retrieving game data:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: getDynamicCorsHeaders(request)
    });
  }
}