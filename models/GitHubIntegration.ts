import mongoose, { Document, Model } from "mongoose";

interface IGitHubIntegration extends Document {
  userId: string;
  githubUsername: string;
  accessToken: string;
  refreshToken?: string;
  connectedAt: Date;
  lastUsed: Date;
}

const GitHubIntegrationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  githubUsername: { type: String, required: true },
  accessToken: { type: String, required: true }, // TODO: Encrypt in production
  refreshToken: { type: String },
  connectedAt: { type: Date, default: Date.now },
  lastUsed: { type: Date, default: Date.now }
});

const GitHubIntegrationModel = mongoose.models.GitHubIntegration || 
  mongoose.model("GitHubIntegration", GitHubIntegrationSchema);

export default GitHubIntegrationModel;