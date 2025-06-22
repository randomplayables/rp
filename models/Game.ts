import mongoose, { Document, Model } from "mongoose";
import { IGame } from "@/types/Game";

// Assuming IRLInstructionSchema is defined or simple enough to be inline
const IRLInstructionSchema = new mongoose.Schema({
  title: String,
  url: String
}, { _id: false });

const GameSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  image: String,
  name: String,
  description: String, // Added this line
  year: Number,
  link: String,
  version: { type: String, default: '1.0.0' },
  irlInstructions: [IRLInstructionSchema],
  codeUrl: String,
  authorUsername: String,
});

const GameModel: Model<IGame & Document> =
  mongoose.models.Game || mongoose.model<IGame & Document>("Game", GameSchema);

export default GameModel;