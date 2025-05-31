import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { currentUser } from "@clerk/nextjs/server";

// Define sandbox connection
// This creates a separate connection to avoid interfering with production data
let sandboxConnection: mongoose.Connection | null = null;

async function connectToSandbox() {
  if (sandboxConnection) {
    return sandboxConnection;
  }
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }
  
  try {
    // Create connection to the sandbox database
    sandboxConnection = await mongoose.createConnection(MONGODB_URI, {
      dbName: "GameLabSandbox",
    });
    
    console.log("Connected to GameLab sandbox database");
    return sandboxConnection;
  } catch (error) {
    console.error("Error connecting to sandbox database:", error);
    throw error;
  }
}

// Define sandbox models
async function getSandboxModels() {
  const conn = await connectToSandbox();
  
  // Game model for sandbox
  const GameSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    name: { type: String, required: true },
    description: { type: String },
    year: { type: Number, default: new Date().getFullYear() },
    image: { type: String, default: "/placeholder-game.png" },
    link: { type: String, required: true },
    irlInstructions: [{ 
      title: String,
      url: String
    }],
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    isTestGame: { type: Boolean, default: true }
  });
  
  // Game session model for sandbox
  const GameSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String },
    gameId: { type: String, required: true },
    startTime: { type: Date, default: Date.now },
    isTestSession: { type: Boolean, default: true }
  });
  
  // Game data model for sandbox
  const GameDataSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    gameId: { type: String, required: true },
    userId: { type: String },
    roundNumber: { type: Number },
    roundData: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    isTestData: { type: Boolean, default: true }
  });
  
  // Register the models with the sandbox connection
  const SandboxGame = conn.models.Game || conn.model("Game", GameSchema);
  const SandboxGameSession = conn.models.GameSession || conn.model("GameSession", GameSessionSchema);
  const SandboxGameData = conn.models.GameData || conn.model("GameData", GameDataSchema);
  
  return {
    Game: SandboxGame,
    GameSession: SandboxGameSession,
    GameData: SandboxGameData
  };
}

// API Endpoints
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();
    
    const clerkUser = await currentUser();
    const userId = clerkUser?.id || "test-user";
    
    // Connect to sandbox and get models
    const models = await getSandboxModels();
    
    // Handle different sandbox actions
    switch (action) {
      case "create_game": {
        // Create a new test game
        const gameData = {
          ...data,
          id: Date.now(), // Simple ID generation
          createdBy: userId,
          isTestGame: true
        };
        
        const newGame = await models.Game.create(gameData);
        return NextResponse.json({ success: true, game: newGame });
      }
      
      case "create_session": {
        // Create a new test game session
        const sessionId = uuidv4();
        const sessionData = {
          sessionId,
          userId,
          // gameId: data.gameId,
          gameId: String(data.gameId), 
          isTestSession: true
        };
        
        const newSession = await models.GameSession.create(sessionData);
        return NextResponse.json({ success: true, session: newSession });
      }
      
      case "save_game_data": {
        // Save test game data
        const gameData = {
          ...data,
          userId,
          isTestData: true,
          gameId: String(data.gameId) 
        };
        
        const newGameData = await models.GameData.create(gameData);
        return NextResponse.json({ success: true, gameData: newGameData });
      }
      
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Error in sandbox API:", error);
    return NextResponse.json(
      { error: "Sandbox operation failed", details: error.message },
      { status: 500 }
    );
  }
}

// For retrieving data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const gameId = searchParams.get("gameId");
    const sessionId = searchParams.get("sessionId");
    
    const clerkUser = await currentUser();
    const userId = clerkUser?.id || "test-user";
    
    // Connect to sandbox and get models
    const models = await getSandboxModels();
    
    if (action === "get_game_data") {
      if (!gameId || !sessionId) {
        return NextResponse.json(
          { error: "Missing gameId or sessionId" },
          { status: 400 }
        );
      }
      
      // Retrieve test game data
      const gameData = await models.GameData.find({
        gameId,
        sessionId,
        isTestData: true
      }).sort({ timestamp: 1 });
      
      return NextResponse.json({ success: true, gameData });
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error in sandbox API:", error);
    return NextResponse.json(
      { error: "Sandbox operation failed", details: error.message },
      { status: 500 }
    );
  }
}