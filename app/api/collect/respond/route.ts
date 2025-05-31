import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";
import { currentUser } from "@clerk/nextjs/server";
import mongoose from "mongoose";

// Import the UserInstrument model schema
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

// Get or create the model
let UserInstrumentModel: mongoose.Model<any>;
try {
  UserInstrumentModel = mongoose.models.UserInstrument || 
    mongoose.model("UserInstrument", UserInstrumentSchema);
} catch (error) {
  console.error("Error with instrument model definition:", error);
  UserInstrumentModel = mongoose.model("UserInstrument", UserInstrumentSchema);
}

export async function POST(request: NextRequest) {
  try {
    const { surveyId, responses, gameSessionIds } = await request.json();
    
    await connectToDatabase();
    
    // Get user if authenticated
    const clerkUser = await currentUser();
    
    // Prepare response data
    const responseData = {
      surveyId,
      respondentId: clerkUser?.id,
      responses,
      metadata: {
        userAgent: request.headers.get("user-agent") || "unknown",
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        startTime: new Date(),
        endTime: new Date()
      }
    };
    
    // Save response to database
    const surveyResponse = await SurveyResponseModel.create(responseData);
    
    // NEW CODE: Update the UserInstrument's responseCount by recounting
    try {
      // Count the total responses for this survey
      const responseCount = await SurveyResponseModel.countDocuments({ surveyId });
      
      // Update the UserInstrument with the accurate count
      const updateResult = await UserInstrumentModel.updateOne(
        { surveyId },
        { $set: { responseCount } }
      );
      
      console.log(`Updated UserInstrument response count to ${responseCount}. Match count: ${updateResult.matchedCount}, Modified count: ${updateResult.modifiedCount}`);
    } catch (updateError) {
      console.error("Error updating UserInstrument response count:", updateError);
      // Don't reject the response - we still saved the survey response successfully
    }
    
    return NextResponse.json({ 
      success: true, 
      responseId: surveyResponse._id
    });
  } catch (error: any) {
    console.error("Error saving survey response:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}