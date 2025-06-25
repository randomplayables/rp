import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { currentUser } from "@clerk/nextjs/server";
import { incrementUserContribution, decrementUserContribution, ContributionType } from "@/lib/contributionUpdater";
import { SketchGameModel } from "@/models/SketchData"; // Import the new SketchGame model

// Define the schema
const UserSketchSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  files: { type: mongoose.Schema.Types.Mixed, required: true },
  previewImage: { type: String },
  gameId: { type: String }, // Use gameId
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

// Define a type for the model to avoid TypeScript errors
type UserSketchDocument = mongoose.Document & {
  userId: string;
  username: string;
  title: string;
  description?: string;
  files: mongoose.Schema.Types.Mixed;
  previewImage?: string;
  gameId?: string; // Use gameId
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
};

type UserSketchModelType = mongoose.Model<UserSketchDocument>;

// Get or create the model
let UserSketchModel: UserSketchModelType;
try {
  UserSketchModel = mongoose.models.UserSketch as UserSketchModelType || 
    mongoose.model<UserSketchDocument>("UserSketch", UserSketchSchema);
} catch (error) {
  console.error("Error with sketch model definition:", error);
  UserSketchModel = mongoose.model<UserSketchDocument>("UserSketch", UserSketchSchema);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const username = searchParams.get("username");
    
    await connectToDatabase();
    
    const filter: any = {};
    
    if (userId) {
      filter.userId = userId;
    } else if (username) {
      filter.username = username;
      filter.isPublic = true;
    } else {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      filter.userId = clerkUser.id;
    }
    
    const sketches = await UserSketchModel.find(filter).sort({ createdAt: -1 });
    
    return NextResponse.json({ sketches });
  } catch (error: any) {
    console.error("Error fetching sketches:", error);
    return NextResponse.json({ error: "Internal error", details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Starting POST to /api/profile/sketches");
    
    const clerkUser = await currentUser();
    if (!clerkUser) {
      console.log("No authenticated user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("User authenticated:", clerkUser.id);
    
    const { title, description, files, previewImage, isPublic } = await request.json();
    console.log("Received sketch data:", { title, files: files ? Object.keys(files) : 'No files' });
    
    await connectToDatabase();
    console.log("Connected to database for sketch");

    const newGameId = `sketch-${clerkUser.username}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    await SketchGameModel.create({
      gameId: newGameId,
      name: title,
      description: description,
      authorUserId: clerkUser.id,
      authorUsername: clerkUser.username || "unknown",
    });
    console.log("Created entry in sketch_games with ID:", newGameId);
    
    const sketch = await UserSketchModel.create({
      userId: clerkUser.id,
      username: clerkUser.username,
      title,
      description,
      files,
      previewImage,
      isPublic: isPublic !== undefined ? isPublic : true,
      gameId: newGameId, // Link to the new sketch_games entry
    });

    await incrementUserContribution(
      clerkUser.id, 
      clerkUser.username || 'unknown',
      ContributionType.SKETCH
    );
    
    console.log("Sketch created with ID:", sketch._id);
    
    return NextResponse.json({ 
      success: true, 
      sketch: {
        id: sketch._id,
        title: sketch.title,
        gameId: sketch.gameId,
      }
    });
  } catch (error: any) {
    console.error("Error saving sketch:", error);
    return NextResponse.json({ error: "Internal error", details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing sketch ID" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const sketch = await UserSketchModel.findOne({
      _id: id,
      userId: clerkUser.id
    });
    
    if (!sketch) {
      return NextResponse.json({ error: "Sketch not found or not owned by user" }, { status: 404 });
    }

    // Also delete from sketch_games, sketch_gamesessions, and sketch_gamedata
    if (sketch.gameId) {
      const { SketchGameSessionModel, SketchGameDataModel } = await import('@/models/SketchData');
      const sessions = await SketchGameSessionModel.find({ gameId: sketch.gameId });
      const sessionIds = sessions.map(s => s.sessionId);
      
      await SketchGameDataModel.deleteMany({ sessionId: { $in: sessionIds } });
      await SketchGameSessionModel.deleteMany({ gameId: sketch.gameId });
      await SketchGameModel.deleteOne({ gameId: sketch.gameId });
      console.log("Deleted associated sketch data for game ID:", sketch.gameId);
    }
    
    await UserSketchModel.deleteOne({ _id: id });

    await decrementUserContribution(
      clerkUser.id,
      ContributionType.SKETCH
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting sketch:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}