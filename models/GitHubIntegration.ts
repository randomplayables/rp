import mongoose, { Document, Model } from "mongoose";

// Base interface for GitHubIntegration (plain object structure)
export interface IGitHubIntegrationBase {
  userId: string;
  githubUsername: string;
  accessToken: string; // TODO: Encrypt in production
  refreshToken?: string;
  connectedAt: Date;
  lastUsed: Date;
}

// Mongoose Document interface for GitHubIntegration
export interface IGitHubIntegration extends IGitHubIntegrationBase, Document {}

const GitHubIntegrationSchemaFields = {
  userId: { type: String, required: true, unique: true },
  githubUsername: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  connectedAt: { type: Date, default: Date.now },
  lastUsed: { type: Date, default: Date.now }
};

const GitHubIntegrationSchema = new mongoose.Schema(GitHubIntegrationSchemaFields);

const GitHubIntegrationModel: Model<IGitHubIntegration> = mongoose.models.GitHubIntegration ||
  mongoose.model<IGitHubIntegration>("GitHubIntegration", GitHubIntegrationSchema);

export default GitHubIntegrationModel;