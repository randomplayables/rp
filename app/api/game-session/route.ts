// app/api/game-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import { currentUser } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from "uuid";

// Add this OPTIONS handler for preflight requests
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { gameId } = await request.json();
    
    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId." }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    // Get current user if logged in
    const clerkUser = await currentUser();
    const userId = clerkUser?.id || null;
    const isGuest = !userId;
    
    // Create a unique session ID
    const sessionId = uuidv4();
    
    // Get IP and user agent for tracking guest sessions
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent");
    
    // Create a new game session
    const gameSession = await GameSessionModel.create({
      userId,
      gameId,
      sessionId,
      ipAddress,
      userAgent,
      isGuest
    });
    
    return NextResponse.json({ 
      sessionId,
      userId,
      isGuest,
      gameId
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error: any) {
    console.error("Error creating game session:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}

// Update the GET endpoint with CORS headers too
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    await connectToDatabase();
    const session = await GameSessionModel.findOne({ sessionId });
    
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { 
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    return NextResponse.json({
      userId: session.userId,
      isGuest: session.isGuest,
      gameId: session.gameId,
      sessionId: session.sessionId
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error: any) {
    console.error("Error verifying game session:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}