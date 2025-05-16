import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import QuestionModel from "@/models/Question";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
    const userId = searchParams.get("userId");  // Add this line
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    await connectToDatabase();
    
    // Build query based on filters
    const query: any = {};
    if (tag) query.tags = tag;
    if (search) query.title = { $regex: search, $options: 'i' };
    if (userId) query.userId = userId;  // Add this line
    
    // Execute query with pagination
    const questions = await QuestionModel.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const total = await QuestionModel.countDocuments(query);
    
    return NextResponse.json({ 
      questions, 
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

// POST - Create a new question
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { title, body, tags } = await request.json();
    
    // Validate required fields
    if (!title || !body) {
      return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Create new question
    const question = await QuestionModel.create({
      userId: clerkUser.id,
      username: clerkUser.username,
      title,
      body,
      tags: tags || [],
      upvotes: [],
      downvotes: [],
      views: 0
    });
    
    return NextResponse.json({ 
      success: true, 
      question: {
        id: question._id,
        title: question.title
      }
    });
  } catch (error: any) {
    console.error("Error creating question:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}