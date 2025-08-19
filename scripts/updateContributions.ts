import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { connectToDatabase } from "../lib/mongodb";
import { UserContributionModel, PayoutConfigModel, IPayoutConfig, PointTransferModel } from "../models/RandomPayables";
import GitHubIntegrationModel, { IGitHubIntegrationBase } from "../models/GitHubIntegration";
import GameModel from "../models/Game";
import { fetchUserRepoActivity } from "../lib/githubApi";
import { prisma } from "../lib/prisma";
import mongoose, { Model } from "mongoose";

interface LeanUserContent {
    userId: string;
    username: string;
}

const UserVisualizationSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }, createdAt: { type: Date, default: Date.now }, isPublic: { type: Boolean, default: true }});
const UserSketchSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }, createdAt: { type: Date, default: Date.now }, isPublic: { type: Boolean, default: true }});
const UserInstrumentSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }, createdAt: { type: Date, default: Date.now }, isPublic: { type: Boolean, default: true }});
const QuestionSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }, createdAt: { type: Date, default: Date.now }});
const AnswerSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }, createdAt: { type: Date, default: Date.now }});

async function updateUserContributions() {
  let mongooseConnected = false;
  try {
    await connectToDatabase();
    mongooseConnected = true;
    console.log("Connected to MongoDB");

    const UserVisualizationModel = mongoose.models.UserVisualization || mongoose.model("UserVisualization", UserVisualizationSchema);
    const UserSketchModel = mongoose.models.UserSketch || mongoose.model("UserSketch", UserSketchSchema);
    const UserInstrumentModel = mongoose.models.UserInstrument || mongoose.model("UserInstrument", UserInstrumentSchema);
    const QuestionModel = mongoose.models.Question || mongoose.model("Question", QuestionSchema);
    const AnswerModel = mongoose.models.Answer || mongoose.model("Answer", AnswerSchema);

    const payoutConfigDoc: IPayoutConfig | null = await PayoutConfigModel.findOne();
    if (!payoutConfigDoc || !payoutConfigDoc.githubRepoDetails || typeof payoutConfigDoc.githubRepoDetails.owner !== 'string') {
        throw new Error("Payout configuration or githubRepoDetails not found or invalid.");
    }
    const { owner, repo, pointsPerCommit, pointsPerLineChanged } = payoutConfigDoc.githubRepoDetails;

    const allUsers = new Map<string, string>();
    const collections: { model: Model<any>, name: string }[] = [
      { model: UserVisualizationModel, name: 'visualizations' }, { model: UserSketchModel, name: 'sketches' },
      { model: UserInstrumentModel, name: 'instruments' }, { model: QuestionModel, name: 'questions' },
      { model: AnswerModel, name: 'answers' },
      { model: GameModel, name: 'games' }
    ];
    for (const { model, name } of collections) {
      console.log(`Fetching users from ${name}...`);
      const items = await model.find({}, 'userId username authorUsername').lean() as unknown as (LeanUserContent & {authorUsername?: string})[];
      items.forEach((item) => { 
        if (item.userId && item.username) {
            allUsers.set(item.userId, item.username);
        }
    });
    }
    const githubIntegrations: IGitHubIntegrationBase[] = await GitHubIntegrationModel.find({}, 'userId githubUsername').lean();
    for (const ghIntegration of githubIntegrations) {
      if (ghIntegration.userId && ghIntegration.githubUsername && !allUsers.has(ghIntegration.userId)) {
        const profile = await prisma.profile.findUnique({ where: { userId: ghIntegration.userId }, select: { username: true } });
        allUsers.set(ghIntegration.userId, profile?.username || ghIntegration.githubUsername);
      }
    }
    console.log(`Found ${allUsers.size} unique users.`);

    for (const [userId, username] of allUsers) {
      console.log(`\nUpdating contributions for ${username} (${userId})...`);

      const existingContribution = await UserContributionModel.findOne({ userId }).lean();
      const existingMetrics = existingContribution?.metrics || {
          peerReviewPoints: 0,
          totalPoints: 0,
      };

      const visualizationCount = await UserVisualizationModel.countDocuments({ userId });
      const sketchCount = await UserSketchModel.countDocuments({ userId });
      const instrumentCount = await UserInstrumentModel.countDocuments({ userId });
      const questionCount = await QuestionModel.countDocuments({ userId });
      const answerCount = await AnswerModel.countDocuments({ userId });
      const gamePublicationCount = await GameModel.countDocuments({ authorUsername: username });
      
      const gamePublicationPoints = gamePublicationCount * 50;
      console.log(`  Found ${gamePublicationCount} published games -> ${gamePublicationPoints} points.`);

      let rawEarnedGithubRepoPoints = 0;
      const userGithubIntegration = githubIntegrations.find(ghInt => ghInt.userId === userId);
      if (userGithubIntegration && userGithubIntegration.githubUsername) {
        const activity = await fetchUserRepoActivity(owner, repo, userGithubIntegration.githubUsername);
        if (activity) {
          rawEarnedGithubRepoPoints = (activity.commits * pointsPerCommit) + (activity.linesChanged * pointsPerLineChanged);
          console.log(`  GitHub Repo Activity for ${userGithubIntegration.githubUsername}: ${activity.commits} commits, ${activity.linesChanged} lines -> ${rawEarnedGithubRepoPoints.toFixed(2)} points`);
        } else { console.log(`  No GitHub repo activity found for ${userGithubIntegration.githubUsername} or error fetching.`); }
      } else { console.log(`  No GitHub integration found for user ${userId}.`); }

      const sent = await PointTransferModel.aggregate([
          { $match: { senderUserId: userId, pointType: 'githubRepoPoints' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const received = await PointTransferModel.aggregate([
          { $match: { recipientUserId: userId, pointType: 'githubRepoPoints' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const netTransfersGithub = (received[0]?.total || 0) - (sent[0]?.total || 0);
      console.log(`  Net transfers for ${username} (GitHub): ${netTransfersGithub}`);

      const newMetrics = {
          codeContributions: sketchCount * 10,
          contentCreation: (visualizationCount * 8) + (instrumentCount * 8),
          communityEngagement: (questionCount * 5) + (answerCount * 3),
          gamePublicationPoints: gamePublicationPoints,
          githubRepoPoints: rawEarnedGithubRepoPoints + netTransfersGithub,
          peerReviewPoints: existingMetrics.peerReviewPoints,
          totalPoints: existingMetrics.totalPoints,
      };

      await UserContributionModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            username,
            metrics: newMetrics,
            updatedAt: new Date()
          }
        },
        { new: true, upsert: true }
      );
      console.log(`  Stored updated metrics for ${username}.`);
    }

    console.log("\nRecalculating all win probabilities based on new metrics...");
    const { updateAllProbabilities } = await import("../lib/payablesEngine");
    await updateAllProbabilities();
    console.log("\nContribution update complete!");

    const topContributors = await UserContributionModel.find().sort({ winProbability: -1 }).limit(5);
    console.log("\nTop 5 Contributors (by Win Probability):");
    topContributors.forEach((contrib, idx) => {
      console.log(`${idx + 1}. ${contrib.username}: ${(contrib.winProbability * 100).toFixed(4)}% win chance (GH Points: ${contrib.metrics.githubRepoPoints.toFixed(0)}, Other Cat. Points: ${contrib.metrics.totalPoints.toFixed(0)})`);
    });

  } catch (error) {
    console.error("Error in updateUserContributions:", error);
  } finally {
    if (mongooseConnected && mongoose.connection.readyState !== 0) {
      try { await mongoose.disconnect(); console.log("Disconnected from MongoDB in updateContributions"); }
      catch (disconnectError) { console.error("Error disconnecting from MongoDB:", disconnectError); }
    }
    try { await prisma.$disconnect(); console.log("Disconnected from Prisma in updateContributions"); }
    catch (prismaDisconnectError) { console.error("Error disconnecting from Prisma:", prismaDisconnectError); }
  }
}

updateUserContributions()
  .then(() => console.log("updateUserContributions script finished successfully."))
  .catch((err) => console.error("Unhandled error in updateUserContributions script execution:", err));