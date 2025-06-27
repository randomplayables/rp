import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PayoutConfigModel, IPayoutConfig, IPayoutConfigBase } from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import mongoose from "mongoose";

// GET endpoint to retrieve the current payout configuration
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    let configFromDbDoc: (IPayoutConfig & mongoose.Document) | null = await PayoutConfigModel.findOne();

    const defaultGithubRepoDetails = {
      owner: process.env.DEFAULT_GH_OWNER || "randomplayables",
      repo: process.env.DEFAULT_GH_REPO || "rp",
      pointsPerCommit: 10,
      pointsPerLineChanged: 0.1
    };
    
    const defaultTopLevelWeights = {
      githubPlatformWeight: 0.4,
      peerReviewWeight: 0.4,
      otherContributionsWeight: 0.2,
    };

    if (!configFromDbDoc) {
      console.log("No payout config found, creating a default one.");
      configFromDbDoc = await PayoutConfigModel.create({
        totalPool: 1000,
        batchSize: 100,
        topLevelWeights: defaultTopLevelWeights,
        weights: {
          codeWeight: 1.0,
          contentWeight: 0.8,
          communityWeight: 0.5,
        },
        githubRepoDetails: defaultGithubRepoDetails,
        lastUpdated: new Date(),
        nextScheduledRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    } else {
      // Ensure nested objects exist for older documents
      if (!configFromDbDoc.githubRepoDetails || typeof configFromDbDoc.githubRepoDetails.owner === 'undefined') {
        configFromDbDoc.githubRepoDetails = defaultGithubRepoDetails;
      }
      if (!configFromDbDoc.topLevelWeights || typeof configFromDbDoc.topLevelWeights.githubPlatformWeight === 'undefined') {
        configFromDbDoc.topLevelWeights = defaultTopLevelWeights;
      }
    }

    const plainConfig = configFromDbDoc.toObject({ versionKey: false }) as IPayoutConfigBase;

    // Ensure the final response object is always complete
    const responseConfig: IPayoutConfigBase = {
      totalPool: plainConfig.totalPool,
      batchSize: plainConfig.batchSize,
      topLevelWeights: plainConfig.topLevelWeights || defaultTopLevelWeights,
      weights: plainConfig.weights || { codeWeight: 1, contentWeight: 0.8, communityWeight: 0.5, gamePublicationWeight: 0.25 },
      githubRepoDetails: plainConfig.githubRepoDetails || defaultGithubRepoDetails,
      lastUpdated: plainConfig.lastUpdated,
      nextScheduledRun: plainConfig.nextScheduledRun,
    };

    return NextResponse.json({ config: responseConfig });
  } catch (error: any) {
    console.error("Error fetching payout configuration:", error);
    return NextResponse.json({
      error: "Internal Error",
      details: error.message
    }, { status: 500 });
  }
}

// POST endpoint to update the payout configuration
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const updateData = await request.json() as Partial<IPayoutConfigBase>;

    await connectToDatabase();

    let currentConfigDoc = await PayoutConfigModel.findOne();
    let fullUpdateData = { ...updateData };

    if (updateData.githubRepoDetails && currentConfigDoc?.githubRepoDetails) {
        const existingDetails = currentConfigDoc.githubRepoDetails;
        fullUpdateData.githubRepoDetails = {
            ...(existingDetails.toObject ? existingDetails.toObject() : existingDetails),
            ...updateData.githubRepoDetails
        };
    }

    const updatedConfigDoc = await PayoutConfigModel.findOneAndUpdate(
      {},
      { $set: { ...fullUpdateData, lastUpdated: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );

    if (!updatedConfigDoc) {
        throw new Error("Failed to update or create configuration.");
    }
    
    const plainObject = updatedConfigDoc.toObject({ versionKey: false }) as IPayoutConfigBase;
     const defaultGithubRepoDetails = {
      owner: process.env.DEFAULT_GH_OWNER || "randomplayables",
      repo: process.env.DEFAULT_GH_REPO || "rp",
      pointsPerCommit: 10,
      pointsPerLineChanged: 0.1
    };
    
    const defaultTopLevelWeights = {
      githubPlatformWeight: 0.4,
      peerReviewWeight: 0.4,
      otherContributionsWeight: 0.2,
    };

    const configToReturn: IPayoutConfigBase = {
        totalPool: plainObject.totalPool,
        batchSize: plainObject.batchSize,
        topLevelWeights: plainObject.topLevelWeights || defaultTopLevelWeights,
        weights: plainObject.weights || { codeWeight: 1, contentWeight: 0.8, communityWeight: 0.5, gamePublicationWeight: 0.25 },
        githubRepoDetails: plainObject.githubRepoDetails || defaultGithubRepoDetails,
        lastUpdated: plainObject.lastUpdated,
        nextScheduledRun: plainObject.nextScheduledRun,
    };

    return NextResponse.json({ success: true, config: configToReturn });
  } catch (error: any) {
    console.error("Error updating payout configuration:", error);
    return NextResponse.json({
      error: "Internal Error",
      details: error.message
    }, { status: 500 });
  }
}