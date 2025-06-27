import mongoose, { Document, Model } from "mongoose";

// Interface for contribution metrics
export interface ContributionMetrics {
  codeContributions: number;
  contentCreation: number;
  communityEngagement: number;
  githubRepoPoints: number;
  gamePublicationPoints: number; // ADDED
  totalPoints: number; // This represents "Other Category Points"
  peerReviewPoints: number;
}

// Base interface for Payout Configuration (plain object structure)
export interface IPayoutConfigBase {
  totalPool: number;
  batchSize: number;
  weights: {
    codeWeight: number;
    contentWeight: number;
    communityWeight: number;
    gamePublicationWeight: number; // ADDED
  };
  githubRepoDetails: {
    toObject?(): { owner: string; repo: string; pointsPerCommit: number; pointsPerLineChanged: number; } | undefined;
    owner: string;
    repo: string;
    pointsPerCommit: number;
    pointsPerLineChanged: number;
  };
  lastUpdated: Date;
  nextScheduledRun: Date;
}

// Mongoose Document interface for Payout Configuration
export interface IPayoutConfig extends IPayoutConfigBase, Document {}

// Interface for user contribution records (no changes needed here for this error set)
export interface IUserContribution extends Document {
  userId: string;
  username: string;
  metrics: ContributionMetrics;
  winProbability: number;
  winCount: number;
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for payout records (no changes needed here for this error set)
export interface IPayoutRecord extends Document {
  batchId: string;
  userId: string;
  username: string;
  amount: number;
  probability: number;
  timestamp: Date;
  stripeTransferId?: string;
  status?: 'completed' | 'failed' | 'requires_stripe_setup';
  stripeError?: string;
}

// Mongoose schema for user contributions
const UserContributionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  metrics: {
    codeContributions: { type: Number, default: 0 },
    contentCreation: { type: Number, default: 0 },
    communityEngagement: { type: Number, default: 0 },
    githubRepoPoints: { type: Number, default: 0 },
    gamePublicationPoints: { type: Number, default: 0 }, // ADDED
    totalPoints: { type: Number, default: 0 },
    peerReviewPoints: { type: Number, default: 0 }
  },
  winProbability: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 },
  lastCalculated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Mongoose schema for payout records
const PayoutRecordSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  amount: { type: Number, required: true },
  probability: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  stripeTransferId: { type: String, index: true },
  status: { type: String, default: 'completed' },
  stripeError: { type: String },
});

// Mongoose schema for payout configuration
const PayoutConfigSchemaDefinition = {
  totalPool: { type: Number, default: 0 },
  batchSize: { type: Number, default: 100 },
  weights: {
    gamePublicationWeight: { type: Number, default: 0.25 }, // ADDED & UPDATED
    communityWeight: { type: Number, default: 0.15 }, // UPDATED
    codeWeight: { type: Number, default: 0.05 }, // UPDATED
    contentWeight: { type: Number, default: 0.05 }, // UPDATED
  },
  githubRepoDetails: {
    owner: { type: String, default: "randomplayables" },
    repo: { type: String, default: "rp" },
    pointsPerCommit: { type: Number, default: 10 },
    pointsPerLineChanged: { type: Number, default: 0.1 }
  },
  lastUpdated: { type: Date, default: Date.now },
  nextScheduledRun: { type: Date }
};
const PayoutConfigSchema = new mongoose.Schema(PayoutConfigSchemaDefinition);


// Create the models
export const UserContributionModel: Model<IUserContribution> =
  mongoose.models.UserContribution || mongoose.model<IUserContribution>("UserContribution", UserContributionSchema);

export const PayoutRecordModel: Model<IPayoutRecord> =
  mongoose.models.PayoutRecord || mongoose.model<IPayoutRecord>("PayoutRecord", PayoutRecordSchema);

export const PayoutConfigModel: Model<IPayoutConfig> =
  mongoose.models.PayoutConfig || mongoose.model<IPayoutConfig>("PayoutConfig", PayoutConfigSchema);

export default { UserContributionModel, PayoutRecordModel, PayoutConfigModel };