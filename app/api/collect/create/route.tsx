import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import SurveyModel from "@/models/Survey";
import { currentUser } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, questions } = await request.json();
    
    await connectToDatabase();

    // Generate a unique link for the survey
    const uniqueId = uuidv4().substring(0, 8);
    const shareableLink = `${process.env.NEXT_PUBLIC_BASE_URL}/survey/${uniqueId}`;

    // Create new survey in the database
    const survey = await SurveyModel.create({
      userId: clerkUser.id,
      username: clerkUser.username,
      title,
      description,
      questions: questions.map((q: any) => ({ ...q, questionId: uuidv4() })),
      shareableLink
    });

    return NextResponse.json({ 
      success: true, 
      survey: {
        id: survey._id,
        shareableLink: survey.shareableLink,
        title: survey.title
      }
    });
  } catch (error: any) {
    console.error("Error creating survey:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}