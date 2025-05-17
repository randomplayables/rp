// lib/payablesEngine.ts
import { v4 as uuidv4 } from "uuid";
import {
  UserContributionModel,
  PayoutRecordModel,
  PayoutConfigModel,
  ContributionMetrics,
  IUserContribution,
  IPayoutConfig
} from "@/models/RandomPayables";

// Default weights for contribution types
const DEFAULT_WEIGHTS = {
  codeWeight: 1.0,
  contentWeight: 0.8,
  communityWeight: 0.5,
  bugReportWeight: 0.3
};

/**
 * Calculate the total points for a user based on their metrics and weights
 */
export function calculateTotalPoints(metrics: ContributionMetrics, weights: IPayoutConfig['weights']): number {
  return (
    metrics.codeContributions * weights.codeWeight +
    metrics.contentCreation * weights.contentWeight +
    metrics.communityEngagement * weights.communityWeight +
    metrics.bugReports * weights.bugReportWeight
  );
}

/**
 * Calculate win probability for a single user
 */
export function calculateWinProbability(userPoints: number, totalPointsAllUsers: number): number {
  if (totalPointsAllUsers === 0) return 0;
  return userPoints / totalPointsAllUsers;
}

/**
 * Update all user probabilities
 * This recalculates all users' total points and win probabilities
 */
export async function updateAllProbabilities(): Promise<void> {
  // Get the current configuration
  const config = await PayoutConfigModel.findOne();
  const weights = config?.weights || DEFAULT_WEIGHTS;
  
  // Get all user contributions
  const users = await UserContributionModel.find();
  
  // Calculate total points across all users
  let totalPointsAllUsers = 0;
  
  // First pass: calculate total points for each user and sum them up
  for (const user of users) {
    user.metrics.totalPoints = calculateTotalPoints(user.metrics, weights);
    totalPointsAllUsers += user.metrics.totalPoints;
  }
  
  // Second pass: calculate win probability for each user and save
  const updates = users.map(user => {
    const winProbability = calculateWinProbability(user.metrics.totalPoints, totalPointsAllUsers);
    
    return UserContributionModel.updateOne(
      { _id: user._id },
      { 
        $set: { 
          'metrics.totalPoints': user.metrics.totalPoints,
          winProbability,
          lastCalculated: new Date() 
        } 
      }
    );
  });
  
  // Execute all updates
  await Promise.all(updates);
}

/**
 * Get a user's current win probability
 */
export async function getUserWinProbability(userId: string): Promise<number> {
  const user = await UserContributionModel.findOne({ userId });
  if (!user) return 0;
  
  // Check if probability needs to be recalculated (older than 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (user.lastCalculated < twentyFourHoursAgo) {
    await updateAllProbabilities();
    const updatedUser = await UserContributionModel.findOne({ userId });
    return updatedUser?.winProbability || 0;
  }
  
  return user.winProbability;
}

/**
 * Run a simulation for a payout (for visualization purposes)
 */
export async function simulatePayouts(amount: number): Promise<Array<{userId: string; username: string; dollars: number}>> {
  // Get all users with their probabilities
  const users = await UserContributionModel.find().lean();
  
  // If no users, return empty array
  if (users.length === 0) return [];
  
  // Create output array to track how many dollars each user wins
  const results = users.map(user => ({
    userId: user.userId,
    username: user.username,
    dollars: 0
  }));
  
  // Distribute dollars one by one based on probabilities
  for (let i = 0; i < amount; i++) {
    const winnerIndex = weightedRandomSelection(users.map(u => u.winProbability));
    if (winnerIndex !== -1) {
      results[winnerIndex].dollars += 1;
    }
  }
  
  // Sort by dollars (highest first) and return
  return results.sort((a, b) => b.dollars - a.dollars);
}

/**
 * Execute a real payout and record the results
 */
export async function executePayout(amount: number): Promise<string> {
  // Get config
  const config = await PayoutConfigModel.findOne();
  if (!config || config.totalPool < amount) {
    throw new Error('Insufficient funds in the pool');
  }
  
  // Generate a batch ID for this payout run
  const batchId = uuidv4();
  
  // Get all users with their probabilities
  const users = await UserContributionModel.find();
  
  // If no users, return early
  if (users.length === 0) return batchId;
  
  // Create lookup map for quick access
  const userMap = new Map<string, IUserContribution>();
  users.forEach(user => userMap.set(user.userId, user));
  
  // Track payouts for this batch
  const payoutRecords = [];
  
  // Distribute dollars one by one
  for (let i = 0; i < amount; i++) {
    // Select a winner
    const winnerIndex = weightedRandomSelection(users.map(u => u.winProbability));
    
    if (winnerIndex !== -1) {
      const winner = users[winnerIndex];
      
      // Create payout record
      payoutRecords.push({
        batchId,
        userId: winner.userId,
        username: winner.username,
        amount: 1, // $1 at a time
        probability: winner.winProbability,
        timestamp: new Date()
      });
      
      // Update win count for this user
      await UserContributionModel.updateOne(
        { userId: winner.userId },
        { $inc: { winCount: 1 } }
      );
    }
  }
  
  // Save all payout records
  await PayoutRecordModel.insertMany(payoutRecords);
  
  // Update the pool
  await PayoutConfigModel.updateOne(
    { _id: config._id },
    { 
      $inc: { totalPool: -amount },
      $set: { lastUpdated: new Date() }
    }
  );
  
  return batchId;
}

/**
 * Get a user's payout history
 */
export async function getUserPayoutHistory(userId: string): Promise<{ 
  totalAmount: number; 
  recentPayouts: Array<{ amount: number; timestamp: Date }> 
}> {
  const payouts = await PayoutRecordModel.find({ userId }).sort({ timestamp: -1 }).limit(100);
  
  const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  
  const recentPayouts = payouts.map(payout => ({
    amount: payout.amount,
    timestamp: payout.timestamp
  }));
  
  return { totalAmount, recentPayouts };
}

/**
 * Utility function for weighted random selection
 * Returns the index of the selected item based on weights
 */
function weightedRandomSelection(weights: number[]): number {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  // If total weight is 0, return -1 (no selection)
  if (totalWeight === 0) return -1;
  
  // Get a random number between 0 and totalWeight
  const random = Math.random() * totalWeight;
  
  // Find the item that corresponds to this random point
  let weightSum = 0;
  for (let i = 0; i < weights.length; i++) {
    weightSum += weights[i];
    if (random < weightSum) {
      return i;
    }
  }
  
  // Fallback in case of floating point issues
  return weights.length - 1;
}