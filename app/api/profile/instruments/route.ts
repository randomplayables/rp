import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";
import { currentUser } from "@clerk/nextjs/server";

// Define the schema
const UserInstrumentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  surveyId: { type: String, required: true },
  questionCount: { type: Number, default: 0 },
  responseCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true },
  shareableLink: { type: String, required: true }
});

// Define a type for the model to avoid TypeScript errors
type UserInstrumentDocument = mongoose.Document & {
  userId: string;
  username: string;
  title: string;
  description?: string;
  surveyId: string;
  questionCount: number;
  responseCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  shareableLink: string;
};

type UserInstrumentModelType = mongoose.Model<UserInstrumentDocument>;

// Get or create the model
let UserInstrumentModel: UserInstrumentModelType;
try {
  // Check if the model is already registered
  UserInstrumentModel = mongoose.models.UserInstrument as UserInstrumentModelType || 
    mongoose.model<UserInstrumentDocument>("UserInstrument", UserInstrumentSchema);
} catch (error) {
  console.error("Error with instrument model definition:", error);
  UserInstrumentModel = mongoose.model<UserInstrumentDocument>("UserInstrument", UserInstrumentSchema);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    
    await connectToDatabase();
    
    let targetUserId = userId;
    
    if (!targetUserId) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      targetUserId = clerkUser.id;
    }
    
    const instruments = await UserInstrumentModel.find({ 
      userId: targetUserId,
      ...(userId ? { isPublic: true } : {})
    }).sort({ createdAt: -1 });
    
    return NextResponse.json({ instruments });
  } catch (error: any) {
    console.error("Error fetching instruments:", error);
    return NextResponse.json({ error: "Internal error", details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Starting POST to /api/profile/instruments");
    
    const clerkUser = await currentUser();
    if (!clerkUser) {
      console.log("No authenticated user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("User authenticated:", clerkUser.id);
    
    const { surveyId, isPublic } = await request.json();
    console.log("Received survey ID:", surveyId);
    
    if (!surveyId) {
      return NextResponse.json({ error: "Missing survey ID" }, { status: 400 });
    }
    
    await connectToDatabase();
    console.log("Connected to database for instrument");
    
    // Get the survey details
    const survey = await SurveyModel.findById(surveyId);
    
    if (!survey || survey.userId !== clerkUser.id) {
      return NextResponse.json({ error: "Survey not found or not owned by user" }, { status: 404 });
    }
    
    // Count the responses
    const responseCount = await SurveyResponseModel.countDocuments({ surveyId });
    
    // Create user instrument entry
    const instrument = await UserInstrumentModel.create({
      userId: clerkUser.id,
      username: clerkUser.username,
      title: survey.title,
      description: survey.description,
      surveyId,
      questionCount: survey.questions.length,
      responseCount,
      isPublic: isPublic !== undefined ? isPublic : true,
      shareableLink: survey.shareableLink
    });
    
    console.log("Instrument created with ID:", instrument._id);
    
    return NextResponse.json({ 
      success: true, 
      instrument: {
        id: instrument._id,
        title: instrument.title
      }
    });
  } catch (error: any) {
    console.error("Error saving instrument:", error);
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
      return NextResponse.json({ error: "Missing instrument ID" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const instrument = await UserInstrumentModel.findOne({
      _id: id,
      userId: clerkUser.id
    });
    
    if (!instrument) {
      return NextResponse.json({ error: "Instrument not found or not owned by user" }, { status: 404 });
    }
    
    await UserInstrumentModel.deleteOne({ _id: id });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting instrument:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}