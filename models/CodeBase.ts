import mongoose, { Document, Model } from "mongoose";

interface ICodeBase extends Document {
  gameId: string;          // Reference to the Game model
  gameName: string;        // Name of the game
  version: string;         // Game version (e.g., '1.0.1')
  codeContent: string;     // Complete codebase content (XML/text format)
  contentType: string;     // Format type (e.g., "repomix-xml", "source-code")
  lastUpdated: Date;       // When the codebase was last updated
}

const CodeBaseSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  gameName: { type: String, required: true },
  version: { type: String, required: true },
  codeContent: { type: String, required: true },
  contentType: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now }
});

// A game can have multiple versions, so the compound index ensures uniqueness per version
CodeBaseSchema.index({ gameId: 1, version: 1 }, { unique: true });

const CodeBaseModel: Model<ICodeBase> = 
  mongoose.models.CodeBase || mongoose.model("CodeBase", CodeBaseSchema);

export default CodeBaseModel;