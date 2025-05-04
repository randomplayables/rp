import mongoose, { Document, Model } from "mongoose";

interface IGameSession extends Document {
  userId: string | null; // null for guests
  gameId: string;
  sessionId: string;
  startTime: Date;
  ipAddress?: string; // Optional, for tracking anonymous sessions
  userAgent?: string; // Optional, can help identify device/browser
  isGuest: boolean;
}

const GameSessionSchema = new mongoose.Schema({
  userId: { type: String, default: null },
  gameId: { type: String, required: true },
  sessionId: { type: String, required: true, unique: true },
  startTime: { type: Date, default: Date.now },
  ipAddress: String,
  userAgent: String,
  isGuest: { type: Boolean, default: false }
});

// You could add indices for faster lookups
GameSessionSchema.index({ userId: 1, gameId: 1 });
GameSessionSchema.index({ sessionId: 1 }, { unique: true });

const GameSessionModel: Model<IGameSession> =
  mongoose.models.GameSession || mongoose.model("GameSession", GameSessionSchema);

export default GameSessionModel;