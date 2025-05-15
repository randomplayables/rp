import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import AnswerModel from "@/models/Answer";
import QuestionModel from "@/models/Question";
import { currentUser } from "@clerk/nextjs/server";

// PUT - Update an answer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { body } = await request.json();
    
    await connectToDatabase();
    
    // Find the answer
    const answer = await AnswerModel.findById(params.id);
    
    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }
    
    // Check ownership
    if (answer.userId !== clerkUser.id) {
      return NextResponse.json({ error: "Not authorized to edit this answer" }, { status: 403 });
    }
    
    // Update the answer
    const updatedAnswer = await AnswerModel.findByIdAndUpdate(
      params.id,
      {
        body: body || answer.body,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    return NextResponse.json({ success: true, answer: updatedAnswer });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update answer" }, { status: 500 });
  }
}

// DELETE - Delete an answer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    await connectToDatabase();
    
    // Find the answer
    const answer = await AnswerModel.findById(params.id);
    
    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }
    
    // Check ownership
    if (answer.userId !== clerkUser.id) {
      return NextResponse.json({ error: "Not authorized to delete this answer" }, { status: 403 });
    }
    
    // Delete the answer
    await AnswerModel.findByIdAndDelete(params.id);
    
    // If this was the accepted answer, update the question
    await QuestionModel.updateOne(
      { acceptedAnswerId: params.id },
      { $unset: { acceptedAnswerId: "" } }
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete answer" }, { status: 500 });
  }
}