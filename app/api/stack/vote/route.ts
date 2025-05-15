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
    
    const { id, type, voteType } = await request.json();
    
    if (!id || !type || !voteType) {
      return NextResponse.json({ 
        error: "Missing required fields: id, type (question/answer), voteType (up/down)" 
      }, { status: 400 });
    }
    
    if (type !== 'question' && type !== 'answer') {
      return NextResponse.json({ error: "Type must be 'question' or 'answer'" }, { status: 400 });
    }
    
    if (voteType !== 'up' && voteType !== 'down') {
      return NextResponse.json({ error: "Vote type must be 'up' or 'down'" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const Model = type === 'question' ? QuestionModel : AnswerModel;
    const item = await Model.findById(id);
    
    if (!item) {
      return NextResponse.json({ error: `${type} not found` }, { status: 404 });
    }
    
    const userId = clerkUser.id;
    
    // Handle upvote
    if (voteType === 'up') {
      // Remove from downvotes if present
      if (item.downvotes.includes(userId)) {
        await Model.findByIdAndUpdate(id, { $pull: { downvotes: userId } });
      }
      
      // Add to upvotes if not already present
      if (!item.upvotes.includes(userId)) {
        await Model.findByIdAndUpdate(id, { $push: { upvotes: userId } });
      } else {
        // If already upvoted, remove the upvote (toggle)
        await Model.findByIdAndUpdate(id, { $pull: { upvotes: userId } });
      }
    } 
    // Handle downvote
    else {
      // Remove from upvotes if present
      if (item.upvotes.includes(userId)) {
        await Model.findByIdAndUpdate(id, { $pull: { upvotes: userId } });
      }
      
      // Add to downvotes if not already present
      if (!item.downvotes.includes(userId)) {
        await Model.findByIdAndUpdate(id, { $push: { downvotes: userId } });
      } else {
        // If already downvoted, remove the downvote (toggle)
        await Model.findByIdAndUpdate(id, { $pull: { downvotes: userId } });
      }
    }
    
    // Get updated item
    const updatedItem = await Model.findById(id);
    
    return NextResponse.json({ 
      success: true,
      upvotes: updatedItem.upvotes.length,
      downvotes: updatedItem.downvotes.length,
      userVote: updatedItem.upvotes.includes(userId) ? 'up' : 
                updatedItem.downvotes.includes(userId) ? 'down' : null
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500 });
  }
}