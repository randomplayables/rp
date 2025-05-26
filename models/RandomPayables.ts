// models/RandomPayables.ts
import mongoose, { Document, Model } from "mongoose";

// Interface for contribution metrics
export interface ContributionMetrics {
  codeContributions: number;    // Points from code submissions
  contentCreation: number;      // Points from games, visualizations created
  communityEngagement: number;  // Points from forum participation
  bugReports: number;           // Points from valid bug reports
  totalPoints: number;          // Sum of all weighted points
}

// Interface for user contribution records
export interface IUserContribution extends Document {
  userId: string;               // User ID from Clerk
  username: string;             // Username for display
  metrics: ContributionMetrics; // Contribution metrics
  winProbability: number;       // Calculated probability of winning
  winCount: number;             // Number of times user has won
  lastCalculated: Date;         // Last time probability was calculated
  createdAt: Date;              // Record creation date
  updatedAt: Date;              // Record update date
}

// Interface for payout records
export interface IPayoutRecord extends Document {
  batchId: string;              // Unique ID for a payout batch
  userId: string;               // User ID who received payment
  username: string;             // Username of recipient
  amount: number;               // Amount paid (in dollars)
  probability: number;          // Probability at time of win
  timestamp: Date;              // When the payout occurred
  stripeTransferId?: string; // Add this
  status?: 'completed' | 'failed' | 'requires_stripe_setup'; // Add this
  stripeError?: string; // Add this
}

// Interface for payout configuration
export interface IPayoutConfig extends Document {
  totalPool: number;            // Total amount in the pool
  batchSize: number;            // Dollars to distribute per batch
  weights: {                    // Weights for different contribution types
    codeWeight: number;         // Weight for code contributions
    contentWeight: number;      // Weight for content creation
    communityWeight: number;    // Weight for community engagement
    bugReportWeight: number;    // Weight for bug reports
  };
  lastUpdated: Date;            // Last time config was updated
  nextScheduledRun: Date;       // Next scheduled payout run
}

// Mongoose schema for user contributions
const UserContributionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  metrics: {
    codeContributions: { type: Number, default: 0 },
    contentCreation: { type: Number, default: 0 },
    communityEngagement: { type: Number, default: 0 },
    bugReports: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
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
  stripeTransferId: { type: String, index: true }, // Add this
  status: { type: String, default: 'completed' }, // Add this
  stripeError: { type: String }, // Add this
});

// Mongoose schema for payout configuration
const PayoutConfigSchema = new mongoose.Schema({
  totalPool: { type: Number, default: 0 },
  batchSize: { type: Number, default: 100 },
  weights: {
    codeWeight: { type: Number, default: 1.0 },
    contentWeight: { type: Number, default: 0.8 },
    communityWeight: { type: Number, default: 0.5 },
    bugReportWeight: { type: Number, default: 0.3 }
  },
  lastUpdated: { type: Date, default: Date.now },
  nextScheduledRun: { type: Date }
});

// Create the models
export const UserContributionModel: Model<IUserContribution> = 
  mongoose.models.UserContribution || mongoose.model<IUserContribution>("UserContribution", UserContributionSchema);

export const PayoutRecordModel: Model<IPayoutRecord> = 
  mongoose.models.PayoutRecord || mongoose.model<IPayoutRecord>("PayoutRecord", PayoutRecordSchema);

export const PayoutConfigModel: Model<IPayoutConfig> = 
  mongoose.models.PayoutConfig || mongoose.model<IPayoutConfig>("PayoutConfig", PayoutConfigSchema);

export default { UserContributionModel, PayoutRecordModel, PayoutConfigModel };