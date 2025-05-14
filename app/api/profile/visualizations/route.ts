import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { currentUser } from "@clerk/nextjs/server";

// Define the schema
const UserVisualizationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  code: { type: String, required: true },
  previewImage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

// Define a type for the model to avoid TypeScript errors
type UserVisualizationDocument = mongoose.Document & {
  userId: string;
  username: string;
  title: string;
  description?: string;
  code: string;
  previewImage?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
};

type UserVisualizationModel = mongoose.Model<UserVisualizationDocument>;

// Get or create the model
let UserVisualizationModel: UserVisualizationModel;
try {
  // Check if the model is already registered
  UserVisualizationModel = mongoose.models.UserVisualization as UserVisualizationModel || 
    mongoose.model<UserVisualizationDocument>("UserVisualization", UserVisualizationSchema);
} catch (error) {
  console.error("Error with model definition:", error);
  UserVisualizationModel = mongoose.model<UserVisualizationDocument>("UserVisualization", UserVisualizationSchema);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    
    await connectToDatabase();
    
    // If userId is provided, fetch that user's visualizations
    // Otherwise, fetch the current user's visualizations
    let targetUserId = userId;
    
    if (!targetUserId) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      targetUserId = clerkUser.id;
    }
    
    const visualizations = await UserVisualizationModel.find({ 
      userId: targetUserId,
      ...(userId ? { isPublic: true } : {}) // Only show public items for other users
    }).sort({ createdAt: -1 });
    
    return NextResponse.json({ visualizations });
  } catch (error: any) {
    console.error("Error fetching visualizations:", error);
    return NextResponse.json({ error: "Internal error", details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Starting POST to /api/profile/visualizations");
    
    const clerkUser = await currentUser();
    if (!clerkUser) {
      console.log("No authenticated user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("User authenticated:", clerkUser.id);
    
    try {
      const { title, description, code, previewImage, isPublic } = await request.json();
      console.log("Received data:", { title, hasDescription: !!description, codeLength: code?.length });
      
      await connectToDatabase();
      console.log("Connected to database");
      
      const visualization = await UserVisualizationModel.create({
        userId: clerkUser.id,
        username: clerkUser.username,
        title,
        description,
        code,
        previewImage,
        isPublic: isPublic !== undefined ? isPublic : true
      });
      
      console.log("Visualization created with ID:", visualization._id);
      
      return NextResponse.json({ 
        success: true, 
        visualization: {
          id: visualization._id,
          title: visualization.title
        }
      });
    } catch (innerError: any) {
      console.error("Error in request processing:", innerError);
      return NextResponse.json({ 
        error: "Processing error", 
        details: innerError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Outer error saving visualization:", error);
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
      return NextResponse.json({ error: "Missing visualization ID" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Make sure the visualization belongs to the current user
    const visualization = await UserVisualizationModel.findOne({
      _id: id,
      userId: clerkUser.id
    });
    
    if (!visualization) {
      return NextResponse.json({ error: "Visualization not found or not owned by user" }, { status: 404 });
    }
    
    await UserVisualizationModel.deleteOne({ _id: id });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting visualization:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}