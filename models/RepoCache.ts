import mongoose from "mongoose";

const RepoCacheSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  path: { type: String, default: "" },
  content: mongoose.Schema.Types.Mixed,
  lastUpdated: { type: Date, default: Date.now }
});

// Create a compound index for efficient lookups
RepoCacheSchema.index({ owner: 1, repo: 1, path: 1 }, { unique: true });

const RepoCacheModel = mongoose.models.RepoCache || 
  mongoose.model("RepoCache", RepoCacheSchema);

export default RepoCacheModel;