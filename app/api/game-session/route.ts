// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import GameSessionModel from "@/models/GameSession";
// import { currentUser } from "@clerk/nextjs/server";
// import { v4 as uuidv4 } from "uuid"; // You'll need to install this: npm install uuid @types/uuid
// import { runMiddleware } from "@/lib/cors"; // Import the middleware

// // Add this OPTIONS handler for preflight requests
// export async function OPTIONS(request: NextRequest) {
//     const response = new NextResponse(null, { status: 200 });
    
//     // Add CORS headers manually for OPTIONS requests
//     response.headers.set('Access-Control-Allow-Origin', 'http://localhost:5173');
//     response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
//     response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
//     response.headers.set('Access-Control-Max-Age', '86400');
    
//     return response;
//   }

// export async function POST(request: NextRequest) {
// // Create a custom response object to add headers to
//   const response = new NextResponse();
//   try {
//     await connectToDatabase();
//     const { gameId } = await request.json();
    
//     if (!gameId) {
//       return NextResponse.json({ error: "Missing gameId." }, { status: 400 });
//     }
    
//     // Get current user if logged in
//     const clerkUser = await currentUser();
//     const userId = clerkUser?.id || null;
//     const isGuest = !userId;
    
//     // Create a unique session ID
//     const sessionId = uuidv4();
    
//     const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
//     const userAgent = request.headers.get("user-agent");
    
//     // Create a new game session
//     const gameSession = await GameSessionModel.create({
//       userId,
//       gameId,
//       sessionId,
//       ipAddress,
//       userAgent,
//       isGuest
//     });
    
//     return NextResponse.json({ 
//       sessionId,
//       userId,
//       isGuest,
//       gameId
//     });
//   } catch (error: any) {
//     console.error("Error creating game session:", error);
//     return NextResponse.json({ error: "Internal Error." }, { status: 500 });
//   }
// }

// // Also add a GET endpoint to verify sessions
// export async function GET(request: NextRequest) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const sessionId = searchParams.get("sessionId");
    
//     if (!sessionId) {
//       return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
//     }
    
//     await connectToDatabase();
//     const session = await GameSessionModel.findOne({ sessionId });
    
//     if (!session) {
//       return NextResponse.json({ error: "Session not found." }, { status: 404 });
//     }
    
//     return NextResponse.json({
//       userId: session.userId,
//       isGuest: session.isGuest,
//       gameId: session.gameId,
//       sessionId: session.sessionId
//     });
//   } catch (error: any) {
//     console.error("Error verifying game session:", error);
//     return NextResponse.json({ error: "Internal Error." }, { status: 500 });
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import { currentUser } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from "uuid";
import { runMiddleware } from "@/lib/cors"; // Import the middleware

// Add this OPTIONS handler for preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  
  // Add CORS headers manually for OPTIONS requests
  response.headers.set('Access-Control-Allow-Origin', 'http://localhost:5173');
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

export async function POST(request: NextRequest) {
  // Create a custom response object to add headers to
  const response = new NextResponse();
  
  // Add CORS headers directly (alternative approach)
  response.headers.set('Access-Control-Allow-Origin', 'http://localhost:5173');
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    await connectToDatabase();
    const { gameId } = await request.json();
    
    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId." }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
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
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error: any) {
    console.error("Error creating game session:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }
    
    await connectToDatabase();
    const session = await GameSessionModel.findOne({ sessionId });
    
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { 
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
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
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error: any) {
    console.error("Error verifying game session:", error);
    return NextResponse.json({ error: "Internal Error." }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
}