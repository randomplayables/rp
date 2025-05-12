import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";
import { currentUser } from "@clerk/nextjs/server";

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
    
    return NextResponse.json({ 
      success: true, 
      responseId: surveyResponse._id
    });
  } catch (error: any) {
    console.error("Error saving survey response:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}