import mongoose, { Document, Model } from "mongoose";
import { IGame } from "@/types/Game";

// Assuming IRLInstructionSchema is defined or simple enough to be inline
const IRLInstructionSchema = new mongoose.Schema({
  title: String,
  url: String
}, { _id: false });

const GameSchema = new mongoose.Schema({
  gameId: { type: String, unique: true, required: true },
  image: String,
  name: String,
  description: String, // Added this line
  year: Number,
  link: String,
  version: { type: String, default: '1.0.0' },
  irlInstructions: [IRLInstructionSchema],
  codeUrl: String,
  authorUsername: String,
  tags: { type: [String], default: [] },
  aiUsageDetails: {
    type: {
      modelType: {
        type: String, // e.g., 'embedding', 'chat', 'image-gen'
        required: true
      },
      isPaid: {
        type: Boolean, // Does this feature require a paid plan?
        required: true,
        default: false
      }
    },
    required: false
  }
});

const GameModel: Model<IGame & Document> =
  mongoose.models.Game || mongoose.model<IGame & Document>("Game", GameSchema);

export default GameModel;