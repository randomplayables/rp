import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import { currentUser } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from "uuid";

// Define dynamicCorsHeaders function to set origin based on request
function getDynamicCorsHeaders(request: NextRequest) {
  // Get the origin from the request
  const origin = request.headers.get('origin');
  
  // List of allowed origins for game API endpoints
  const allowedOrigins = [
    'http://localhost:5173',         // Vite dev server
    'http://localhost:3000',         // Next.js dev server
    'http://172.31.12.157:5173',     // EC2 Vite dev server
    'http://172.31.12.157:3000',     // EC2 Next.js dev server
    'http://54.176.104.229:5173',    // EC2 public IP Vite dev server
    'http://54.176.104.229:3000',    // EC2 public IP Next.js dev server
    'https://randomplayables.com',
    'https://gothamloops.randomplayables.com'
  ];
  
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
    await connectToDatabase();
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    let body;
    
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    
    const { gameId, passedUserId } = body;
    
    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId." }, { 
        status: 400,
        headers: getDynamicCorsHeaders(request)
      });
    }
    
    console.log("Auth Header:", authHeader ? "Present" : "Not present");
    console.log("Passed User ID:", passedUserId || "Not provided");
    
    // Authentication methods (in order of priority):
    // 1. Try to get the user from Clerk's currentUser()
    // 2. If that fails, check for passedUserId in the request body
    
    // First try: Get current user directly from Clerk
    let clerkUser = await currentUser();
    let userId = clerkUser?.id;
    let authSource = "clerk_session";
    
    // Second try: Use passedUserId from request body
    if (!userId && passedUserId) {
      userId = passedUserId;
      authSource = "passed_user_id";
    }
    
    const isGuest = !userId;
    
    console.log("User authentication result:", {
      userId,
      isGuest, 
      authSource: userId ? authSource : "none - using guest"
    });
    
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
      gameId,
      authSource: userId ? authSource : undefined
    }, {
      headers: getDynamicCorsHeaders(request)
    });
  } catch (error: any) {
    console.error("Error creating game session:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: getDynamicCorsHeaders(request)
    });
  }
}

// Update the GET endpoint with dynamic CORS headers too
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
    const session = await GameSessionModel.findOne({ sessionId });
    
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { 
        status: 404,
        headers: getDynamicCorsHeaders(request)
      });
    }
    
    return NextResponse.json({
      userId: session.userId,
      isGuest: session.isGuest,
      gameId: session.gameId,
      sessionId: session.sessionId
    }, {
      headers: getDynamicCorsHeaders(request)
    });
  } catch (error: any) {
    console.error("Error verifying game session:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: getDynamicCorsHeaders(request)
    });
  }
}