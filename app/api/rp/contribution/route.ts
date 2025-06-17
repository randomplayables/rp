import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserContributionModel, PayoutConfigModel } from "@/models/RandomPayables";
import { updateAllProbabilities } from "@/lib/payablesEngine";
import { currentUser } from "@clerk/nextjs/server";

/**
 * GET endpoint to retrieve a user's contribution data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const username = searchParams.get("username");
    
    await connectToDatabase();
    
    // If no specific user is requested, get the current authenticated user
    if (!userId && !username) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      const userContribution = await UserContributionModel.findOne({ 
        userId: clerkUser.id 
      }).lean();
      
      if (!userContribution) {
        return NextResponse.json({ 
          error: "No contribution data found for this user",
          emptyData: true
        }, { status: 404 });
      }
      
      return NextResponse.json({ userContribution });
    }
    
    // Query based on userId or username
    let userContribution;
    if (userId) {
      userContribution = await UserContributionModel.findOne({ userId }).lean();
    } else if (username) {
      userContribution = await UserContributionModel.findOne({ username }).lean();
    }
    
    if (!userContribution) {
      return NextResponse.json({ 
        error: "User contribution not found", 
        emptyData: true 
      }, { status: 404 });
    }
    
    return NextResponse.json({ userContribution });
  } catch (error: any) {
    console.error("Error retrieving user contribution:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * POST endpoint to update a user's contribution data
 * (This would typically be called by an admin or automated system)
 */
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    // For security, this endpoint requires authentication
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { userId, metrics } = await request.json();
    
    // Validate data
    if (!userId || !metrics) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Get username if available
    let username = "unknown";
    if (clerkUser.id === userId) {
      username = clerkUser.username || "unknown";
    } else {
      // To do: check for admin role before allowing updates to other users
      // This is simplified for the example
      const existingUser = await UserContributionModel.findOne({ userId });
      if (existingUser) {
        username = existingUser.username;
      }
    }
    
    // Get config for weights
    const config = await PayoutConfigModel.findOne().lean();
    const weights = config?.weights || {
      codeWeight: 1.0,
      contentWeight: 0.8,
      communityWeight: 0.5,
    };
    
    // Calculate total points
    const totalPoints = 
      metrics.codeContributions * weights.codeWeight +
      metrics.contentCreation * weights.contentWeight +
      metrics.communityEngagement * weights.communityWeight;
    
    // Update or create user contribution
    const updatedUser = await UserContributionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          username,
          metrics: {
            ...metrics,
            totalPoints
          },
          lastCalculated: new Date(),
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );
    
    // Update all probabilities since the pool has changed
    await updateAllProbabilities();
    
    return NextResponse.json({ 
      success: true, 
      userContribution: updatedUser 
    });
  } catch (error: any) {
    console.error("Error updating user contribution:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}