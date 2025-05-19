import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { currentUser } from "@clerk/nextjs/server";
import GameModel from "@/models/Game";
import CodeBaseModel from "@/models/CodeBase";
import { isAdmin } from "@/lib/auth"; // Import our new function

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin status
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if user is admin
    if (!isAdmin(clerkUser.id, clerkUser.username)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
    
    const formData = await request.formData();
    const gameId = formData.get("gameId") as string;
    const codebaseFile = formData.get("codebase") as File;
    
    if (!gameId || !codebaseFile) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Validate that the game exists
    const game = await GameModel.findOne({ id: parseInt(gameId) });
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    
    // Read file content
    const codeContent = await codebaseFile.text();
    
    // Determine content type based on file extension
    const fileName = codebaseFile.name.toLowerCase();
    const contentType = fileName.endsWith('.xml') ? 'repomix-xml' : 'source-code';
    
    // Save or update the codebase
    await CodeBaseModel.findOneAndUpdate(
      { gameId: parseInt(gameId) },
      {
        gameId: parseInt(gameId),
        gameName: game.name,
        codeContent,
        contentType,
        lastUpdated: new Date()
      },
      { upsert: true }
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error uploading codebase:", error);
    return NextResponse.json({ 
      error: "Failed to upload codebase", 
      details: error.message 
    }, { status: 500 });
  }
}