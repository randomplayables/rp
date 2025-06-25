import mongoose, { Document, Model } from "mongoose";

interface IGameData extends Document {
  sessionId: string;
  gameId: string;
  userId: string | null;
  username: string | null; // Add username field
  gameVersion: string;
  timestamp: Date;
  roundNumber: number;
  roundData: any; // Store any JSON data
  isGuest: boolean;
}

const GameDataSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  gameId: { type: String, required: true },
  userId: { type: String, default: null },
  username: { type: String, default: null }, // Add username field
  gameVersion: { type: String },
  timestamp: { type: Date, default: Date.now },
  roundNumber: Number,
  roundData: mongoose.Schema.Types.Mixed, // Allows for flexible JSON storage
  isGuest: { type: Boolean, default: false }
});

// Add indices for faster lookups
GameDataSchema.index({ sessionId: 1 });
GameDataSchema.index({ gameId: 1, userId: 1 });
GameDataSchema.index({ username: 1 }); // Add username index

// Explicitly set the collection name to avoid pluralization issues
const GameDataModel: Model<IGameData> =
  mongoose.models.GameData || mongoose.model("GameData", GameDataSchema, "gamedatas");

export default GameDataModel;