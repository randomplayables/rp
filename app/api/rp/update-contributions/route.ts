import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserContributionModel } from "@/models/RandomPayables";
import { updateAllProbabilities } from "@/lib/payablesEngine";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import mongoose from "mongoose";

// Define schemas for the models we need
const UserVisualizationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

const UserSketchSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

const UserInstrumentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

const QuestionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const AnswerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

async function updateUserContributionData(userId: string, username: string) {
  // Get models
  const UserVisualizationModel = mongoose.models.UserVisualization || 
    mongoose.model("UserVisualization", UserVisualizationSchema);
  const UserSketchModel = mongoose.models.UserSketch || 
    mongoose.model("UserSketch", UserSketchSchema);
  const UserInstrumentModel = mongoose.models.UserInstrument || 
    mongoose.model("UserInstrument", UserInstrumentSchema);
  const QuestionModel = mongoose.models.Question || 
    mongoose.model("Question", QuestionSchema);
  const AnswerModel = mongoose.models.Answer || 
    mongoose.model("Answer", AnswerSchema);

  // Count contributions
  const visualizationCount = await UserVisualizationModel.countDocuments({ userId });
  const sketchCount = await UserSketchModel.countDocuments({ userId });
  const instrumentCount = await UserInstrumentModel.countDocuments({ userId });
  const questionCount = await QuestionModel.countDocuments({ userId });
  const answerCount = await AnswerModel.countDocuments({ userId });

  // Calculate metrics based on content
  const metrics = {
    codeContributions: sketchCount * 10, // Each sketch is worth 10 points
    contentCreation: (visualizationCount * 8) + (instrumentCount * 8), // Each worth 8 points
    communityEngagement: (questionCount * 5) + (answerCount * 3), // Questions worth 5, answers worth 3
    bugReports: 0, // We don't track this yet
    totalPoints: 0 // Will be calculated by the system
  };

  // Update or create the user contribution record
  const result = await UserContributionModel.findOneAndUpdate(
    { userId },
    {
      $set: {
        username,
        metrics,
        lastCalculated: new Date(),
        updatedAt: new Date()
      }
    },
    { new: true, upsert: true }
  );

  return {
    visualizationCount,
    sketchCount,
    instrumentCount,
    questionCount,
    answerCount,
    metrics,
    contribution: result
  };
}

/**
 * GET endpoint to update contributions for a specific user or all users
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    const updateAll = searchParams.get("all") === "true";
    
    await connectToDatabase();
    
    // Get current user
    const clerkUser = await currentUser();
    
    // Check if admin for bulk updates
    if (updateAll && (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username))) {
      return NextResponse.json({ 
        error: "Admin access required for bulk updates" 
      }, { status: 403 });
    }
    
    // Allow users to update their own contributions
    if (targetUserId && clerkUser?.id !== targetUserId && !isAdmin(clerkUser?.id, clerkUser?.username)) {
      return NextResponse.json({ 
        error: "You can only update your own contributions" 
      }, { status: 403 });
    }
    
    const results = [];
    
    if (updateAll) {
      // Update all users (admin only)
      const allUsers = new Map<string, string>();
      
      // Get models
      const models = [
        mongoose.models.UserVisualization || mongoose.model("UserVisualization", UserVisualizationSchema),
        mongoose.models.UserSketch || mongoose.model("UserSketch", UserSketchSchema),
        mongoose.models.UserInstrument || mongoose.model("UserInstrument", UserInstrumentSchema),
        mongoose.models.Question || mongoose.model("Question", QuestionSchema),
        mongoose.models.Answer || mongoose.model("Answer", AnswerSchema)
      ];
      
      // Collect all unique users
      for (const model of models) {
        const items = await model.find({}, 'userId username').lean();
        items.forEach((item: any) => {
          if (item.userId && item.username) {
            allUsers.set(item.userId, item.username);
          }
        });
      }
      
      // Update each user
      for (const [userId, username] of allUsers) {
        const result = await updateUserContributionData(userId, username);
        results.push({ userId, username, ...result });
      }
    } else {
      // Update single user
      const userId = targetUserId || clerkUser?.id;
      const username = clerkUser?.username || "unknown";
      
      if (!userId) {
        return NextResponse.json({ 
          error: "No user ID provided" 
        }, { status: 400 });
      }
      
      const result = await updateUserContributionData(userId, username);
      results.push({ userId, username, ...result });
    }
    
    // Recalculate all probabilities
    await updateAllProbabilities();
    
    return NextResponse.json({ 
      success: true,
      updated: results.length,
      results 
    });
    
  } catch (error: any) {
    console.error("Error updating contributions:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * POST endpoint to force update for current user
 */
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    await connectToDatabase();
    
    const result = await updateUserContributionData(clerkUser.id, clerkUser.username || "unknown");
    
    // Recalculate all probabilities
    await updateAllProbabilities();
    
    return NextResponse.json({ 
      success: true,
      ...result
    });
    
  } catch (error: any) {
    console.error("Error updating contributions:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}