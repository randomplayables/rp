import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { currentUser } from "@clerk/nextjs/server";

let sandboxConnection: mongoose.Connection | null = null;

/**
 * Establishes a dedicated connection to the GameLabSandbox database.
 * This connection is cached to avoid reconnecting on every API call in a serverful environment.
 */
async function connectToSandboxDB(): Promise<mongoose.Connection> {
  if (sandboxConnection && sandboxConnection.readyState === 1) {
    return sandboxConnection;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }
  
  try {
    const conn = mongoose.createConnection(MONGODB_URI);
    sandboxConnection = await conn.useDb("GameLabSandbox", { useCache: true });
    console.log("Successfully connected to GameLabSandbox database.");
    return sandboxConnection;
  } catch (error) {
    console.error("Error connecting to GameLabSandbox database:", error);
    throw new Error("Could not connect to the sandbox database.");
  }
}

/**
 * Defines and returns the Mongoose models for the sandbox collections.
 * These models are specific to the sandbox connection.
 */
async function getSandboxModels() {
  const conn = await connectToSandboxDB();
  
  const GameSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    name: { type: String, required: true },
    description: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
  });
  
  const GameSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String },
    gameId: { type: String, required: true },
    startTime: { type: Date, default: Date.now },
  });
  
  const GameDataSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    gameId: { type: String, required: true },
    userId: { type: String },
    roundNumber: { type: Number },
    roundData: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  });
  
  return {
    Game: conn.models.Game || conn.model("Game", GameSchema, "games"),
    GameSession: conn.models.GameSession || conn.model("GameSession", GameSessionSchema, "gamesessions"),
    GameData: conn.models.GameData || conn.model("GameData", GameDataSchema, "gamedatas"),
  };
}

export async function POST(request: NextRequest) {
  try {
    const models = await getSandboxModels();
    const { action, data } = await request.json();
    const clerkUser = await currentUser();
    const userId = clerkUser?.id || "test-user";

    switch (action) {
      case "create_game": {
        const gameData = {
          name: data.name,
          description: data.description,
          id: Date.now(),
          createdBy: userId,
        };
        const newGame = await models.Game.create(gameData);
        return NextResponse.json({ success: true, game: newGame });
      }
      
      case "create_session": {
        const sessionId = uuidv4();
        const sessionData = {
          sessionId,
          userId,
          gameId: String(data.gameId),
        };
        const newSession = await models.GameSession.create(sessionData);
        return NextResponse.json({ success: true, session: newSession });
      }
      
      case "save_game_data": {
        const gameData = {
          ...data,
          userId,
          gameId: String(data.gameId),
        };
        const newGameData = await models.GameData.create(gameData);
        return NextResponse.json({ success: true, gameData: newGameData });
      }
      
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Error in sandbox API:", error);
    return NextResponse.json({ error: "Sandbox operation failed", details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
    try {
        const models = await getSandboxModels();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
    
        if (action === "get_game_data") {
            const gameId = searchParams.get("gameId");
            const sessionId = searchParams.get("sessionId");

            if (!gameId || !sessionId) {
                return NextResponse.json({ error: "Missing gameId or sessionId" }, { status: 400 });
            }
        
            const gameData = await models.GameData.find({ gameId, sessionId }).sort({ timestamp: 1 });
            return NextResponse.json({ success: true, gameData });
        }
    
        return NextResponse.json({ error: "Invalid GET action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in sandbox API (GET):", error);
    return NextResponse.json({ error: "Sandbox operation failed", details: error.message }, { status: 500 });
  }
}