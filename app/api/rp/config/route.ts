import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PayoutConfigModel, IPayoutConfig, IPayoutConfigBase } from "@/models/RandomPayables"; // Import IPayoutConfigBase
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import mongoose from "mongoose"; // Required for mongoose.Document

// GET endpoint to retrieve the current payout configuration
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    // Fetch as lean object of type IPayoutConfigBase
    let configFromDb: IPayoutConfigBase | null = await PayoutConfigModel.findOne().lean<IPayoutConfigBase>();

    if (!configFromDb) {
      console.log("No payout config found, creating a default one.");
      // Create returns a Mongoose document
      const newConfigDoc = await PayoutConfigModel.create({
        totalPool: 1000,
        batchSize: 100,
        weights: {
          codeWeight: 1.0,
          contentWeight: 0.8,
          communityWeight: 0.5,
          bugReportWeight: 0.3
        },
        githubRepoDetails: {
          owner: "randomplayables",
          repo: "rp",
          pointsPerCommit: 10,
          pointsPerLineChanged: 0.1
        },
        lastUpdated: new Date(),
        nextScheduledRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      // Convert the newly created document to a lean object for consistent return type
      // Ensure all fields from IPayoutConfigBase are present after toObject()
      const plainObject = newConfigDoc.toObject({ versionKey: false }) as unknown as IPayoutConfig; // Cast to full doc first for toObject
      configFromDb = {
        totalPool: plainObject.totalPool,
        batchSize: plainObject.batchSize,
        weights: plainObject.weights,
        githubRepoDetails: plainObject.githubRepoDetails,
        lastUpdated: plainObject.lastUpdated,
        nextScheduledRun: plainObject.nextScheduledRun,
      };
    }
    return NextResponse.json({ config: configFromDb });
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

    // Expecting data that matches IPayoutConfigBase structure
    const updateData = await request.json() as Partial<IPayoutConfigBase>;

    await connectToDatabase();

    const updatedConfigDoc = await PayoutConfigModel.findOneAndUpdate(
      {},
      { $set: { ...updateData, lastUpdated: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );

    if (!updatedConfigDoc) {
        throw new Error("Failed to update or create configuration.");
    }
    
    const plainObject = updatedConfigDoc.toObject({ versionKey: false }) as unknown as IPayoutConfig;
    const configToReturn: IPayoutConfigBase = {
        totalPool: plainObject.totalPool,
        batchSize: plainObject.batchSize,
        weights: plainObject.weights,
        githubRepoDetails: plainObject.githubRepoDetails,
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