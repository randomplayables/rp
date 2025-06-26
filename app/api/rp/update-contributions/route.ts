import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserContributionModel, PayoutConfigModel, IPayoutConfig } from "@/models/RandomPayables";
import GitHubIntegrationModel, { IGitHubIntegrationBase } from "@/models/GitHubIntegration";
import GameModel from "@/models/Game";
import { fetchUserRepoActivity } from "@/lib/githubApi";
import { prisma } from "@/lib/prisma";
import mongoose, { Model } from "mongoose";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import { updateAllProbabilities } from "@/lib/payablesEngine";

interface LeanUserContent {
    userId: string;
    username: string;
}

const UserVisualizationSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }});
const UserSketchSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }});
const UserInstrumentSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }});
const QuestionSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }});
const AnswerSchema = new mongoose.Schema({ userId: { type: String, required: true }, username: { type: String, required: true }});

async function performContributionsUpdate() {
    await connectToDatabase();
    console.log("Connected to MongoDB for contribution update.");

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
    console.log(`Found ${allUsers.size} unique users to update.`);

    for (const [userId, username] of allUsers) {
      console.log(`\nUpdating contributions for ${username} (${userId})...`);
      const visualizationCount = await UserVisualizationModel.countDocuments({ userId });
      const sketchCount = await UserSketchModel.countDocuments({ userId });
      const instrumentCount = await UserInstrumentModel.countDocuments({ userId });
      const questionCount = await QuestionModel.countDocuments({ userId });
      const answerCount = await AnswerModel.countDocuments({ userId });
      
      const gamePublicationCount = await GameModel.countDocuments({ authorUsername: username });
      const pointsPerGame = 50;
      const gamePublicationPoints = gamePublicationCount * pointsPerGame;
      console.log(`  Found ${gamePublicationCount} published games -> ${gamePublicationPoints} points.`);

      let githubRepoPoints = 0;
      const userGithubIntegration = githubIntegrations.find(ghInt => ghInt.userId === userId);
      if (userGithubIntegration && userGithubIntegration.githubUsername) {
        const activity = await fetchUserRepoActivity(owner, repo, userGithubIntegration.githubUsername);
        if (activity) {
          githubRepoPoints = (activity.commits * pointsPerCommit) + (activity.linesChanged * pointsPerLineChanged);
          console.log(`  GitHub Repo Activity for ${userGithubIntegration.githubUsername}: ${activity.commits} commits, ${activity.linesChanged} lines -> ${githubRepoPoints.toFixed(2)} points`);
        } else { console.log(`  No GitHub repo activity found for ${userGithubIntegration.githubUsername} or error fetching.`); }
      } else { console.log(`  No GitHub integration found for user ${userId}.`); }

      await UserContributionModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            username,
            'metrics.codeContributions': sketchCount * 10,
            'metrics.contentCreation': (visualizationCount * 8) + (instrumentCount * 8),
            'metrics.communityEngagement': (questionCount * 5) + (answerCount * 3),
            'metrics.githubRepoPoints': githubRepoPoints,
            'metrics.gamePublicationPoints': gamePublicationPoints,
            updatedAt: new Date()
          }
        },
        { new: true, upsert: true }
      );
      console.log(`  Stored raw metrics for ${username}.`);
    }

    console.log("\nRecalculating all win probabilities based on new metrics...");
    await updateAllProbabilities();
    console.log("\nContribution update process complete!");

    return { updatedUsers: allUsers.size };
}

export async function POST(request: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const result = await performContributionsUpdate();

        return NextResponse.json({
            success: true,
            message: `Successfully updated contributions for ${result.updatedUsers} users.`,
            updatedCount: result.updatedUsers
        });

    } catch (error: any) {
        console.error("Error in /api/rp/update-contributions:", error);
        return NextResponse.json({
            error: "Failed to update contributions.",
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}