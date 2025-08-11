import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
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
    const body = await request.json();
    const { sessionId, roundNumber, roundData, passedUserId, passedUsername } = body;

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
    let username = session.username;
    let isGuest = session.isGuest;

    if (!userId && passedUserId) {
      userId = passedUserId;
      isGuest = false;

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

      // Update the session with the user ID and username
      await GameSessionModel.updateOne(
        { sessionId },
        { $set: { userId: passedUserId, username, isGuest: false } }
      );

      console.log("Updated session with userId from request:", passedUserId, "Username:", username);
    }

    // Log for debugging
    console.log("Saving data for session:", {
      sessionId,
      userId,
      username,
      isGuest,
      gameId: session.gameId,
      gameVersion: session.gameVersion // Log the version
    });

    // Create game data entry
    const gameData = await GameDataModel.create({
      sessionId,
      gameId: session.gameId,
      userId,
      username,
      gameVersion: session.gameVersion, // Store the version
      roundNumber,
      roundData,
      isGuest
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