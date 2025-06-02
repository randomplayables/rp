import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { connectToDatabase } from "../lib/mongodb";
import { UserContributionModel, PayoutConfigModel } from "../models/RandomPayables";
import GitHubIntegrationModel, { IGitHubIntegrationBase } from "../models/GitHubIntegration";
import { fetchUserRepoActivity } from "../lib/githubApi";
import { prisma } from "../lib/prisma";
import mongoose, { Model } from "mongoose";

interface LeanUserContent {
    userId: string;
    username: string;
    // add other fields if selected and used
}

const UserVisualizationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }, isPublic: { type: Boolean, default: true }
});
const UserSketchSchema = new mongoose.Schema({
  userId: { type: String, required: true }, username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }, isPublic: { type: Boolean, default: true }
});
const UserInstrumentSchema = new mongoose.Schema({
  userId: { type: String, required: true }, username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }, isPublic: { type: Boolean, default: true }
});
const QuestionSchema = new mongoose.Schema({
  userId: { type: String, required: true }, username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const AnswerSchema = new mongoose.Schema({
  userId: { type: String, required: true }, username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

async function updateUserContributions() {
  try {
    await connectToDatabase();
    console.log("Connected to MongoDB");

    const UserVisualizationModel = mongoose.models.UserVisualization || mongoose.model("UserVisualization", UserVisualizationSchema);
    const UserSketchModel = mongoose.models.UserSketch || mongoose.model("UserSketch", UserSketchSchema);
    const UserInstrumentModel = mongoose.models.UserInstrument || mongoose.model("UserInstrument", UserInstrumentSchema);
    const QuestionModel = mongoose.models.Question || mongoose.model("Question", QuestionSchema);
    const AnswerModel = mongoose.models.Answer || mongoose.model("Answer", AnswerSchema);

    const payoutConfig = await PayoutConfigModel.findOne().lean();
    if (!payoutConfig || !payoutConfig.githubRepoDetails) {
      console.error("Payout configuration or githubRepoDetails not found. Cannot calculate GitHub points.");
      process.exit(1); // Exit if config is missing
    }
    const { owner, repo, pointsPerCommit, pointsPerLineChanged } = payoutConfig.githubRepoDetails;

    const allUsers = new Map<string, string>();

    const collections: { model: Model<any>, name: string }[] = [
      { model: UserVisualizationModel, name: 'visualizations' },
      { model: UserSketchModel, name: 'sketches' },
      { model: UserInstrumentModel, name: 'instruments' },
      { model: QuestionModel, name: 'questions' },
      { model: AnswerModel, name: 'answers' }
    ];

    for (const { model, name } of collections) {
      console.log(`Fetching users from ${name}...`);
      // Corrected Cast: unknown as LeanUserContent[]
      const items = await model.find({}, 'userId username').lean() as unknown as LeanUserContent[];
      items.forEach((item) => {
        if (item.userId && item.username) {
          allUsers.set(item.userId, item.username);
        }
      });
    }

    const githubIntegrations: IGitHubIntegrationBase[] = await GitHubIntegrationModel.find({}, 'userId githubUsername').lean();
    for (const ghIntegration of githubIntegrations) {
        if (ghIntegration.userId && ghIntegration.githubUsername) {
            if (!allUsers.has(ghIntegration.userId)) {
                const profile = await prisma.profile.findUnique({ where: { userId: ghIntegration.userId }, select: { username: true } });
                allUsers.set(ghIntegration.userId, profile?.username || ghIntegration.githubUsername);
            }
        }
    }

    console.log(`Found ${allUsers.size} unique users.`);

    for (const [userId, username] of allUsers) {
      console.log(`\nUpdating contributions for ${username} (${userId})...`);

      const visualizationCount = await UserVisualizationModel.countDocuments({ userId });
      const sketchCount = await UserSketchModel.countDocuments({ userId });
      const instrumentCount = await UserInstrumentModel.countDocuments({ userId });
      const questionCount = await QuestionModel.countDocuments({ userId });
      const answerCount = await AnswerModel.countDocuments({ userId });

      let githubRepoPoints = 0;
      const userGithubIntegration = githubIntegrations.find(ghInt => ghInt.userId === userId);

      if (userGithubIntegration && userGithubIntegration.githubUsername) {
        const activity = await fetchUserRepoActivity(owner, repo, userGithubIntegration.githubUsername);
        if (activity) {
          githubRepoPoints = (activity.commits * pointsPerCommit) + (activity.linesChanged * pointsPerLineChanged);
          console.log(`  GitHub Repo Activity: ${activity.commits} commits, ${activity.linesChanged} lines -> ${githubRepoPoints.toFixed(2)} points`);
        } else {
          console.log(`  No GitHub repo activity found for ${userGithubIntegration.githubUsername} or error fetching.`);
        }
      } else {
        console.log(`  No GitHub integration found for user ${userId}.`);
      }

      const metrics = {
        codeContributions: sketchCount * 10,
        contentCreation: (visualizationCount * 8) + (instrumentCount * 8),
        communityEngagement: (questionCount * 5) + (answerCount * 3),
        bugReports: 0,
        githubRepoPoints: githubRepoPoints,
        totalPoints: 0
      };

      await UserContributionModel.findOneAndUpdate(
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
      console.log(`  Stored raw metrics for ${username}. githubRepoPoints: ${githubRepoPoints}`);
    }

    console.log("\nRecalculating all win probabilities based on new metrics...");
    const { updateAllProbabilities } = await import("../lib/payablesEngine");
    await updateAllProbabilities();

    console.log("\nContribution update complete!");

    const topContributors = await UserContributionModel.find()
      .sort({ winProbability: -1 })
      .limit(5);

    console.log("\nTop 5 Contributors (by Win Probability):");
    topContributors.forEach((contrib, idx) => {
      console.log(`${idx + 1}. ${contrib.username}: ${(contrib.winProbability * 100).toFixed(4)}% win chance (GH Points: ${contrib.metrics.githubRepoPoints.toFixed(0)}, Other Cat. Points: ${contrib.metrics.totalPoints.toFixed(0)})`);
    });

  } catch (error) {
    console.error("Error updating contributions:", error);
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

updateUserContributions();