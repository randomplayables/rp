// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import GameSessionModel from "@/models/GameSession";
// import GameModel from "@/models/Game"; // Import Game model
// import { currentUser } from "@clerk/nextjs/server";
// import { v4 as uuidv4 } from "uuid";
// import { allowedOrigins } from "../../../lib/corsConfig";
// import { prisma } from "@/lib/prisma";

// // Define dynamicCorsHeaders function to set origin based on request
// function getDynamicCorsHeaders(request: NextRequest) {
//   // Get the origin from the request
//   const origin = request.headers.get('origin');
  
//   let headers = {
//     'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//     'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//     'Access-Control-Max-Age': '86400'
//   };
  
//   // If the origin is in our allowed list, set it specifically
//   if (origin && allowedOrigins.includes(origin)) {
//     return {
//       ...headers,
//       'Access-Control-Allow-Origin': origin,
//       'Access-Control-Allow-Credentials': 'true'
//     };
//   } else {
//     // For other origins, use a wildcard (but credentials won't work)
//     return {
//       ...headers,
//       'Access-Control-Allow-Origin': '*'
//     };
//   }
// }

// // Add this OPTIONS handler for preflight requests
// export async function OPTIONS(request: NextRequest) {
//   return NextResponse.json({}, {
//     status: 200,
//     headers: getDynamicCorsHeaders(request)
//   });
// }

// export async function POST(request: NextRequest) {
//   try {
//     await connectToDatabase();
//     // Get the authorization header
//     const authHeader = request.headers.get('Authorization');
//     let body;
    
//     try {
//       body = await request.json();
//     } catch (e) {
//       body = {};
//     }
    
//     const { gameId, passedUserId, passedUsername, surveyMode, surveyQuestionId } = body;
    
//     if (!gameId) {
//       return NextResponse.json({ error: "Missing gameId." }, { 
//         status: 400,
//         headers: getDynamicCorsHeaders(request)
//       });
//     }

//     // Fetch the game to get its version
//     const game = await GameModel.findOne({ gameId: gameId });
//     if (!game) {
//       return NextResponse.json({ error: "Game not found." }, {
//         status: 404,
//         headers: getDynamicCorsHeaders(request)
//       });
//     }
    
//     console.log("Auth Header:", authHeader ? "Present" : "Not present");
//     console.log("Passed User ID:", passedUserId || "Not provided");
//     console.log("Passed Username:", passedUsername || "Not provided");
    
//     // Authentication methods (in order of priority):
//     // 1. Try to get the user from Clerk's currentUser()
//     // 2. If that fails, check for passedUserId in the request body
    
//     // First try: Get current user directly from Clerk
//     let clerkUser = await currentUser();
//     let userId = clerkUser?.id;
//     let username = clerkUser?.username || null;
//     let authSource = "clerk_session";
    
//     // Second try: Use passedUserId from request body
//     if (!userId && passedUserId) {
//       userId = passedUserId;
      
//       // If passedUsername is provided, use it
//       if (passedUsername) {
//         username = passedUsername;
//       }
//       // Otherwise try to fetch username from Prisma
//       else if (passedUserId) {
//         try {
//           const profile = await prisma.profile.findUnique({
//             where: { userId: passedUserId },
//             select: { username: true }
//           });
          
//           if (profile?.username) {
//             username = profile.username;
//           }
//         } catch (err) {
//           console.error("Error fetching username from Prisma:", err);
//         }
//       }
      
//       authSource = "passed_user_id";
//     }
    
//     const isGuest = !userId;
    
//     console.log("User authentication result:", {
//       userId,
//       username,
//       isGuest, 
//       authSource: userId ? authSource : "none - using guest"
//     });
    
//     // Create a unique session ID
//     const sessionId = uuidv4();
    
//     // Get IP and user agent for tracking guest sessions
//     const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
//     const userAgent = request.headers.get("user-agent");
    
//     // Create a new game session
//     const gameSession = await GameSessionModel.create({
//       userId,
//       username,
//       gameId,
//       gameVersion: game.version, // Store the game version
//       sessionId,
//       ipAddress,
//       userAgent,
//       isGuest,
//       surveyMode: surveyMode || false,
//       surveyQuestionId
//     });
    
//     return NextResponse.json({ 
//       sessionId,
//       userId,
//       username,
//       isGuest,
//       gameId,
//       gameVersion: game.version,
//       surveyMode,
//       surveyQuestionId,
//       authSource: userId ? authSource : undefined
//     }, {
//       headers: getDynamicCorsHeaders(request)
//     });
//   } catch (error: any) {
//     console.error("Error creating game session:", error);
//     return NextResponse.json({ error: "Internal Error." }, { 
//       status: 500,
//       headers: getDynamicCorsHeaders(request)
//     });
//   }
// }

// // Update the GET endpoint with username too
// export async function GET(request: NextRequest) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const sessionId = searchParams.get("sessionId");
    
//     if (!sessionId) {
//       return NextResponse.json({ error: "Missing sessionId." }, { 
//         status: 400,
//         headers: getDynamicCorsHeaders(request)
//       });
//     }
    
//     await connectToDatabase();
//     const session = await GameSessionModel.findOne({ sessionId });
    
//     if (!session) {
//       return NextResponse.json({ error: "Session not found." }, { 
//         status: 404,
//         headers: getDynamicCorsHeaders(request)
//       });
//     }
    
//     return NextResponse.json({
//       userId: session.userId,
//       username: session.username,
//       isGuest: session.isGuest,
//       gameId: session.gameId,
//       gameVersion: session.gameVersion,
//       sessionId: session.sessionId
//     }, {
//       headers: getDynamicCorsHeaders(request)
//     });
//   } catch (error: any) {
//     console.error("Error verifying game session:", error);
//     return NextResponse.json({ error: "Internal Error." }, { 
//       status: 500,
//       headers: getDynamicCorsHeaders(request)
//     });
//   }
// }





import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameModel from "@/models/Game"; // Import Game model
import { currentUser } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from "uuid";
import { isAllowedOrigin } from "../../../lib/corsConfig";
import { prisma } from "@/lib/prisma";

// Define dynamicCorsHeaders function to set origin based on request
function getDynamicCorsHeaders(request: NextRequest) {
  // Get the origin from the request
  const origin = request.headers.get('origin');

  const headersBase = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  } as Record<string, string>;

  // If the origin is allowed, set it specifically with credentials
  if (origin && isAllowedOrigin(origin)) {
    return {
      ...headersBase,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true'
    };
  }

  // For other origins, use a wildcard (but credentials won't work)
  return {
    ...headersBase,
    'Access-Control-Allow-Origin': '*'
  };
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

    const { gameId, passedUserId, passedUsername, surveyMode, surveyQuestionId } = body;

    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId." }, { 
        status: 400,
        headers: getDynamicCorsHeaders(request)
      });
    }

    // Fetch the game to get its version
    const game = await GameModel.findOne({ gameId: gameId });
    if (!game) {
      return NextResponse.json({ error: "Game not found." }, {
        status: 404,
        headers: getDynamicCorsHeaders(request)
      });
    }

    console.log("Auth Header:", authHeader ? "Present" : "Not present");
    console.log("Passed User ID:", passedUserId || "Not provided");
    console.log("Passed Username:", passedUsername || "Not provided");

    // Authentication methods (in order of priority):
    // 1. Try to get the user from Clerk's currentUser()
    // 2. If that fails, check for passedUserId in the request body

    // First try: Get current user directly from Clerk
    let clerkUser = await currentUser();
    let userId = clerkUser?.id;
    let username = clerkUser?.username || null;
    let authSource = "clerk_session";

    // Second try: Use passedUserId from request body
    if (!userId && passedUserId) {
      userId = passedUserId;

      // If passedUsername is provided, use it
      if (passedUsername) {
        username = passedUsername;
      }
      // Otherwise try to fetch username from Prisma
      else if (passedUserId) {
        try {
          const profile = await prisma.profile.findUnique({
            where: { userId: passedUserId },
            select: { username: true }
          });
          if (profile?.username) {
            username = profile.username;
          }
        } catch (err) {
          console.error("Error fetching username from Prisma:", err);
        }
      }

      authSource = "passed_user_id";
    }

    const isGuest = !userId;

    console.log("User authentication result:", {
      userId,
      username,
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
      username,
      gameId,
      gameVersion: game.version, // Store the game version
      sessionId,
      ipAddress,
      userAgent,
      isGuest,
      surveyMode: surveyMode || false,
      surveyQuestionId
    });

    return NextResponse.json({ 
      sessionId,
      userId,
      username,
      isGuest,
      gameId,
      gameVersion: game.version,
      surveyMode,
      surveyQuestionId,
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

// Update the GET endpoint with username too
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
      username: session.username,
      isGuest: session.isGuest,
      gameId: session.gameId,
      gameVersion: session.gameVersion,
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
