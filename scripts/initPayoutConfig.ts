import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { connectToDatabase } from "../lib/mongodb";
import { PayoutConfigModel } from "../models/RandomPayables";
import mongoose from "mongoose";

async function initializePayoutConfig() {
  try {
    await connectToDatabase();
    console.log("Connected to MongoDB");

    const existingConfig = await PayoutConfigModel.findOne();
    
    if (existingConfig) {
      console.log("Payout config already exists. Checking for githubRepoDetails...");
      if (!existingConfig.githubRepoDetails) {
        existingConfig.githubRepoDetails = {
          owner: "randomplayables",
          repo: "rp",
          pointsPerCommit: 10,
          pointsPerLineChanged: 0.1
        };
        existingConfig.markModified('githubRepoDetails'); // Important for Mixed types or nested objects
        await existingConfig.save();
        console.log("Added githubRepoDetails to existing config.");
      } else {
        console.log("githubRepoDetails already present.");
      }
      console.log(existingConfig);
      return;
    }

    const config = await PayoutConfigModel.create({
      totalPool: 1000,
      batchSize: 100,
      weights: { // These are for the "Other Contributions" bucket (50%)
        gamePublicationWeight: 0.25, // Game.games: 25%
        communityWeight: 0.15,       // Community: 15%
        codeWeight: 0.05,            // Code: 5%
        contentWeight: 0.05,         // Content: 5%
      },
      githubRepoDetails: { // Details for the main GitHub repo contributions (50%)
        owner: "randomplayables",
        repo: "rp",
        pointsPerCommit: 10,       // Example: 10 points per commit
        pointsPerLineChanged: 0.1  // Example: 0.1 points per line changed
      },
      lastUpdated: new Date(),
      nextScheduledRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    console.log("Payout config initialized:");
    console.log(config);

  } catch (error) {
    console.error("Error initializing payout config:", error);
  } finally {
    await mongoose.disconnect();
  }
}

initializePayoutConfig();