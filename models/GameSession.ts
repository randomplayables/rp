import mongoose, { Document, Model } from "mongoose";

interface IGameSession extends Document {
  userId: string | null; // null for guests
  username: string | null; // Add username field
  gameId: string;
  sessionId: string;
  startTime: Date;
  ipAddress?: string;
  userAgent?: string;
  isGuest: boolean;
}

const GameSessionSchema = new mongoose.Schema({
  userId: { type: String, default: null },
  username: { type: String, default: null }, // Add username field
  gameId: { type: String, required: true },
  sessionId: { type: String, required: true, unique: true },
  startTime: { type: Date, default: Date.now },
  ipAddress: String,
  userAgent: String,
  isGuest: { type: Boolean, default: false }
});

// Add index for faster lookups
GameSessionSchema.index({ userId: 1, gameId: 1 });
GameSessionSchema.index({ username: 1 }); // Add index for username lookups

const GameSessionModel: Model<IGameSession> =
  mongoose.models.GameSession || mongoose.model("GameSession", GameSessionSchema);

export default GameSessionModel;