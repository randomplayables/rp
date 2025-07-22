import mongoose, { Document, Model, Schema } from "mongoose";

// Define TeamID locally to decouple the model from a specific game's types
export type TeamID = 'A' | 'B';

export interface IGauntletParticipant extends Document {
  userId: string;
  username: string;
  team: TeamID;
  wager: number;
  setupConfig?: any; // To store game-specific setup, e.g., Gowap marble placement
  hasSetup: boolean;
}

const GauntletParticipantSchema = new Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  team: { type: String, required: true },
  wager: { type: Number, required: true },
  setupConfig: { type: Schema.Types.Mixed },
  hasSetup: { type: Boolean, default: false },
}, { _id: false });

export interface IGauntletChallenge extends Document {
  gameId: string; // The type of game, e.g., 'gowap'
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  challenger: IGauntletParticipant;
  opponent?: IGauntletParticipant;
  opponentWager: number; // New field to store wager before opponent joins
  winner?: TeamID;
  lockedSettings?: string[]; // To store which settings the challenger cannot change
  createdAt: Date;
  completedAt?: Date;
}

const GauntletChallengeSchema = new Schema({
  gameId: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed', 'cancelled'], 
    default: 'pending', 
    index: true 
  },
  challenger: { type: GauntletParticipantSchema, required: true },
  opponent: { type: GauntletParticipantSchema, required: false }, // Opponent is not required on creation
  opponentWager: { type: Number, required: true }, // Store this at the top level
  winner: { type: String },
  lockedSettings: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

export const GauntletChallengeModel: Model<IGauntletChallenge> = 
  mongoose.models.GauntletChallenge || mongoose.model<IGauntletChallenge>("GauntletChallenge", GauntletChallengeSchema);