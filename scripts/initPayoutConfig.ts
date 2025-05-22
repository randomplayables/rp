// scripts/initPayoutConfig.ts
import { connectToDatabase } from "../lib/mongodb";
import { PayoutConfigModel } from "../models/RandomPayables";
import mongoose from "mongoose";

async function initializePayoutConfig() {
  try {
    await connectToDatabase();
    console.log("Connected to MongoDB");

    // Check if config already exists
    const existingConfig = await PayoutConfigModel.findOne();
    
    if (existingConfig) {
      console.log("Payout config already exists:");
      console.log(existingConfig);
      return;
    }

    // Create initial config
    const config = await PayoutConfigModel.create({
      totalPool: 1000, // Start with $1000 in the pool
      batchSize: 100,  // Default batch size of $100
      weights: {
        codeWeight: 1.0,
        contentWeight: 0.8,
        communityWeight: 0.5,
        bugReportWeight: 0.3
      },
      lastUpdated: new Date(),
      nextScheduledRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
    });

    console.log("Payout config initialized:");
    console.log(config);

  } catch (error) {
    console.error("Error initializing payout config:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
initializePayoutConfig();

// // scripts/initPayoutConfig.ts
// import dotenv from 'dotenv';
// import path from 'path';

// // Load environment variables from .env.local
// // IMPORTANT: This must be at the very top, before any other imports
// // that might rely on environment variables.
// dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// import { connectToDatabase } from "../lib/mongodb"; // Restored
// import { PayoutConfigModel } from "../models/RandomPayables"; // Restored
// import mongoose from "mongoose"; // Restored

// async function initializePayoutConfig() {
//   try {
//     // Optional: for debugging if MONGODB_URI is loaded
//     // console.log("MONGODB_URI from script:", process.env.MONGODB_URI?.substring(0,30) + "...");

//     await connectToDatabase();
//     console.log("Connected to MongoDB");

//     // Check if config already exists
//     const existingConfig = await PayoutConfigModel.findOne();

//     if (existingConfig) {
//       console.log("Payout config already exists:");
//       console.log(existingConfig);
//       return;
//     }

//     // Create initial config
//     const config = await PayoutConfigModel.create({
//       totalPool: 1000, // Start with $1000 in the pool
//       batchSize: 100,  // Default batch size of $100
//       weights: {
//         codeWeight: 1.0,
//         contentWeight: 0.8,
//         communityWeight: 0.5,
//         bugReportWeight: 0.3
//       },
//       lastUpdated: new Date(),
//       nextScheduledRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
//     });

//     console.log("Payout config initialized:");
//     console.log(config);

//   } catch (error) {
//     console.error("Error initializing payout config:", error);
//   } finally {
//     await mongoose.disconnect();
//     console.log("Disconnected from MongoDB");
//   }
// }

// // Run the script
// initializePayoutConfig();

