// models/CodeBase.ts
import mongoose, { Document, Model } from "mongoose";

interface ICodeBase extends Document {
  gameId: number;          // Reference to the Game model
  gameName: string;        // Name of the game
  codeContent: string;     // Complete codebase content (XML/text format)
  contentType: string;     // Format type (e.g., "repomix-xml", "source-code")
  lastUpdated: Date;       // When the codebase was last updated
}

const CodeBaseSchema = new mongoose.Schema({
  gameId: { type: Number, required: true, unique: true },
  gameName: { type: String, required: true },
  codeContent: { type: String, required: true },
  contentType: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now }
});

const CodeBaseModel: Model<ICodeBase> = 
  mongoose.models.CodeBase || mongoose.model("CodeBase", CodeBaseSchema);

export default CodeBaseModel;