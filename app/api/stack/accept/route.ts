import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import QuestionModel from "@/models/Question";
import AnswerModel from "@/models/Answer";
import { currentUser } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { questionId, answerId } = await request.json();
    
    if (!questionId || !answerId) {
      return NextResponse.json({ error: "Question ID and Answer ID are required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Find the question
    const question = await QuestionModel.findById(questionId);
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    
    // Check if the user is the question owner
    if (question.userId !== clerkUser.id) {
      return NextResponse.json({ 
        error: "Only the question owner can accept an answer" 
      }, { status: 403 });
    }
    
    // Find the answer
    const answer = await AnswerModel.findById(answerId);
    
    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }
    
    // First, remove any previously accepted answer
    if (question.acceptedAnswerId) {
      await AnswerModel.findByIdAndUpdate(question.acceptedAnswerId, { isAccepted: false });
    }
    
    // If toggling the same answer, just remove the accepted mark
    if (question.acceptedAnswerId === answerId) {
      await QuestionModel.findByIdAndUpdate(questionId, { $unset: { acceptedAnswerId: "" } });
      await AnswerModel.findByIdAndUpdate(answerId, { isAccepted: false });
      
      return NextResponse.json({ success: true, accepted: false });
    }
    
    // Otherwise, mark the new answer as accepted
    await QuestionModel.findByIdAndUpdate(questionId, { acceptedAnswerId: answerId });
    await AnswerModel.findByIdAndUpdate(answerId, { isAccepted: true });
    
    return NextResponse.json({ success: true, accepted: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to accept answer" }, { status: 500 });
  }
}