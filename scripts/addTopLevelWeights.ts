import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { connectToDatabase } from "../lib/mongodb";
import { PayoutConfigModel } from "../models/RandomPayables";
import mongoose from "mongoose";

async function addTopLevelWeightsToConfig() {
  try {
    await connectToDatabase();
    console.log("Connected to MongoDB");

    const existingConfig = await PayoutConfigModel.findOne();
    
    if (!existingConfig) {
      console.log("No payout config found. Please run the init script first.");
      return;
    }

    if (existingConfig.topLevelWeights && existingConfig.topLevelWeights.githubPlatformWeight !== undefined) {
        console.log("topLevelWeights already exists in the configuration. No update needed.");
    } else {
        console.log("topLevelWeights not found or is incomplete. Adding with default values...");
        existingConfig.topLevelWeights = {
          githubPlatformWeight: 0.4,
          peerReviewWeight: 0.4,
          otherContributionsWeight: 0.2,
        };
        // Mongoose needs to be explicitly told that a nested object has changed.
        existingConfig.markModified('topLevelWeights');
        await existingConfig.save();
        console.log("Successfully added topLevelWeights to the payout configuration.");
    }

    console.log("Current config:", existingConfig.toObject());

  } catch (error) {
    console.error("Error updating payout config:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

addTopLevelWeightsToConfig();