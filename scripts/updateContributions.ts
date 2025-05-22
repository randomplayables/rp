import { connectToDatabase } from "../lib/mongodb";
import { UserContributionModel } from "../models/RandomPayables";
import { prisma } from "../lib/prisma";
import mongoose from "mongoose";

// Import all the models we need to check
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

async function updateUserContributions() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    console.log("Connected to MongoDB");

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

    // Get all unique users from all collections
    const allUsers = new Map<string, string>(); // userId -> username

    // Collect users from each collection
    const collections = [
      { model: UserVisualizationModel, name: 'visualizations' },
      { model: UserSketchModel, name: 'sketches' },
      { model: UserInstrumentModel, name: 'instruments' },
      { model: QuestionModel, name: 'questions' },
      { model: AnswerModel, name: 'answers' }
    ];

    for (const { model, name } of collections) {
      console.log(`Fetching users from ${name}...`);
      const items = await model.find({}, 'userId username').lean();
      items.forEach((item: any) => {
        if (item.userId && item.username) {
          allUsers.set(item.userId, item.username);
        }
      });
    }

    console.log(`Found ${allUsers.size} unique users across all collections`);

    // Update contributions for each user
    for (const [userId, username] of allUsers) {
      console.log(`\nUpdating contributions for ${username} (${userId})...`);

      // Count contributions
      const visualizationCount = await UserVisualizationModel.countDocuments({ userId });
      const sketchCount = await UserSketchModel.countDocuments({ userId });
      const instrumentCount = await UserInstrumentModel.countDocuments({ userId });
      const questionCount = await QuestionModel.countDocuments({ userId });
      const answerCount = await AnswerModel.countDocuments({ userId });

      console.log(`  Visualizations: ${visualizationCount}`);
      console.log(`  Sketches: ${sketchCount}`);
      console.log(`  Instruments: ${instrumentCount}`);
      console.log(`  Questions: ${questionCount}`);
      console.log(`  Answers: ${answerCount}`);

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

      console.log(`  Total points (before weighting): ${
        metrics.codeContributions + metrics.contentCreation + metrics.communityEngagement
      }`);
    }

    // After updating all users, recalculate probabilities
    console.log("\nRecalculating win probabilities for all users...");
    
    // Import and use the payables engine
    const { updateAllProbabilities } = await import("../lib/payablesEngine");
    await updateAllProbabilities();

    console.log("\nContribution update complete!");

    // Display top contributors
    const topContributors = await UserContributionModel.find()
      .sort({ 'metrics.totalPoints': -1 })
      .limit(5);

    console.log("\nTop 5 Contributors:");
    topContributors.forEach((contrib, idx) => {
      console.log(`${idx + 1}. ${contrib.username}: ${contrib.metrics.totalPoints.toFixed(2)} points (${(contrib.winProbability * 100).toFixed(2)}% win chance)`);
    });

  } catch (error) {
    console.error("Error updating contributions:", error);
  } finally {
    // Close connections
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

// Run the script
updateUserContributions();