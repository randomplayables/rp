import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import AnswerModel from "@/models/Answer";
import { currentUser } from "@clerk/nextjs/server";

// POST - Create a new answer
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { questionId, body } = await request.json();
    
    // Validate required fields
    if (!questionId || !body) {
      return NextResponse.json({ error: "Question ID and body are required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Create new answer
    const answer = await AnswerModel.create({
      questionId,
      userId: clerkUser.id,
      username: clerkUser.username,
      body,
      upvotes: [],
      downvotes: [],
      isAccepted: false
    });
    
    return NextResponse.json({ 
      success: true, 
      answer: {
        id: answer._id,
        body: answer.body
      }
    });
  } catch (error: any) {
    console.error("Error creating answer:", error);
    return NextResponse.json({ error: "Failed to create answer" }, { status: 500 });
  }
}