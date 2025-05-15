import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import QuestionModel from "@/models/Question";
import AnswerModel from "@/models/Answer";
import { currentUser } from "@clerk/nextjs/server";

// GET - Fetch a single question with its answers
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    // Find the question by ID
    const question = await QuestionModel.findById(params.id).lean();
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    
    // Increment view count
    await QuestionModel.findByIdAndUpdate(params.id, { $inc: { views: 1 } });
    
    // Find associated answers
    const answers = await AnswerModel.find({ questionId: params.id })
      .sort({ isAccepted: -1, createdAt: 1 }) // Accepted answers first, then oldest
      .lean();
    
    return NextResponse.json({ question, answers });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 });
  }
}

// PUT - Update a question
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { title, body, tags } = await request.json();
    
    await connectToDatabase();
    
    // Find the question
    const question = await QuestionModel.findById(params.id);
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    
    // Check ownership
    if (question.userId !== clerkUser.id) {
      return NextResponse.json({ error: "Not authorized to edit this question" }, { status: 403 });
    }
    
    // Update the question
    const updatedQuestion = await QuestionModel.findByIdAndUpdate(
      params.id,
      {
        title: title || question.title,
        body: body || question.body,
        tags: tags || question.tags,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

// DELETE - Delete a question
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
    
    // Find the question
    const question = await QuestionModel.findById(params.id);
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    
    // Check ownership
    if (question.userId !== clerkUser.id) {
      return NextResponse.json({ error: "Not authorized to delete this question" }, { status: 403 });
    }
    
    // Delete the question and its answers
    await QuestionModel.findByIdAndDelete(params.id);
    await AnswerModel.deleteMany({ questionId: params.id });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}