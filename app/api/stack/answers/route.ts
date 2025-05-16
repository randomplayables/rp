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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const username = searchParams.get("username");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    await connectToDatabase();
    
    // Build query
    const query: any = {};
    
    // Add user filter
    if (userId) {
      query.userId = userId;
    } else if (username) {
      query.username = username;
    }
    
    // Execute query with pagination
    const answers = await AnswerModel.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const total = await AnswerModel.countDocuments(query);
    
    return NextResponse.json({ 
      answers, 
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch answers" }, { status: 500 });
  }
}