import mongoose, { Document, Model } from "mongoose";

interface IGameSession extends Document {
  userId: string | null; // null for guests
  username: string | null; // Add username field
  gameId: string;
  gameVersion: string;
  sessionId: string;
  startTime: Date;
  ipAddress?: string;
  userAgent?: string;
  isGuest: boolean;
  surveyMode?: boolean;
  surveyQuestionId?: string;
}

const GameSessionSchema = new mongoose.Schema({
  userId: { type: String, default: null },
  username: { type: String, default: null }, // Add username field
  gameId: { type: String, required: true },
  gameVersion: { type: String },
  sessionId: { type: String, required: true, unique: true },
  startTime: { type: Date, default: Date.now },
  ipAddress: String,
  userAgent: String,
  isGuest: { type: Boolean, default: false },
  surveyMode: { type: Boolean, default: false },
  surveyQuestionId: { type: String },
});

// Add index for faster lookups
GameSessionSchema.index({ userId: 1, gameId: 1 });
GameSessionSchema.index({ username: 1 }); // Add index for username lookups
GameSessionSchema.index({ surveyQuestionId: 1 }); // Index for survey lookups

const GameSessionModel: Model<IGameSession> =
  mongoose.models.GameSession || mongoose.model("GameSession", GameSessionSchema);

export default GameSessionModel;