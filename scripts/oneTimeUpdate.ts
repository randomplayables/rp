// scripts/oneTimeUpdate.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { connectToDatabase } from "../lib/mongodb";
import GameModel from "../models/Game";
import GameSessionModel from "../models/GameSession";
import GameDataModel from "../models/GameData";
import CodeBaseModel from "../models/CodeBase";
import GameSubmissionModel from "../models/GameSubmission";
import mongoose from "mongoose";

async function runUpdate() {
  try {
    console.log("Connecting to the database...");
    await connectToDatabase();
    console.log("Database connection successful.");

    console.log("\nStarting one-time database update for versioning fields...");

    // 1. Add a default version to all existing games in the 'games' collection
    const gameUpdateResult = await GameModel.updateMany(
      { version: { $exists: false } },
      { $set: { version: "1.0.0" } }
    );
    console.log(`- Games collection: Found ${gameUpdateResult.matchedCount} documents without a version. Updated ${gameUpdateResult.modifiedCount}.`);

    // 2. Add a default version to existing sessions
    const sessionUpdateResult = await GameSessionModel.updateMany(
      { gameVersion: { $exists: false } },
      { $set: { gameVersion: "pre-1.0.0" } }
    );
    console.log(`- GameSessions collection: Found ${sessionUpdateResult.matchedCount} documents without a gameVersion. Updated ${sessionUpdateResult.modifiedCount}.`);

    // 3. Add a default version to existing game data
    const gameDataUpdateResult = await GameDataModel.updateMany(
      { gameVersion: { $exists: false } },
      { $set: { gameVersion: "pre-1.0.0" } }
    );
    console.log(`- GameData collection: Found ${gameDataUpdateResult.matchedCount} documents without a gameVersion. Updated ${gameDataUpdateResult.modifiedCount}.`);

    // 4. Add a placeholder version to existing codebases
    const codebaseUpdateResult = await CodeBaseModel.updateMany(
      { version: { $exists: false } },
      { $set: { version: "1.0.0" } }
    );
    console.log(`- CodeBases collection: Found ${codebaseUpdateResult.matchedCount} documents without a version. Updated ${codebaseUpdateResult.modifiedCount}.`);

    // 5. Add a placeholder version to existing game submissions
    const submissionUpdateResult = await GameSubmissionModel.updateMany(
      { version: { $exists: false } },
      { $set: { version: "1.0.0" } }
    );
    console.log(`- GameSubmissions collection: Found ${submissionUpdateResult.matchedCount} documents without a version. Updated ${submissionUpdateResult.modifiedCount}.`);

    console.log("\nDatabase update script finished successfully.");

  } catch (error) {
    console.error("An error occurred during the update script:", error);
  } finally {
    // Ensure the connection is closed
    await mongoose.disconnect();
    console.log("Database connection closed.");
  }
}

runUpdate();