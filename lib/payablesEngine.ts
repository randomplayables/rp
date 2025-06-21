import { v4 as uuidv4 } from "uuid";
import {
  UserContributionModel,
  PayoutRecordModel,
  PayoutConfigModel,
  ContributionMetrics,
  IUserContribution,
  IPayoutConfig
} from "@/models/RandomPayables";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Default weights for "other" contribution types (applied within the 50% bucket)
const DEFAULT_OTHER_WEIGHTS = {
  gamePublicationWeight: 0.25, // ADDED
  communityWeight: 0.15,
  codeWeight: 0.05,
  contentWeight: 0.05,
};

/**
 * Calculate the "Other Category" points for a user.
 * These are points from non-GitHub repo contributions.
 */
export function calculateOtherCategoryPoints(metrics: ContributionMetrics, otherWeights: IPayoutConfig['weights']): number {
  return (
    ((metrics.codeContributions || 0) * (otherWeights.codeWeight || 0)) +
    ((metrics.contentCreation || 0) * (otherWeights.contentWeight || 0)) +
    ((metrics.communityEngagement || 0) * (otherWeights.communityWeight || 0)) +
    ((metrics.gamePublicationPoints || 0) * (otherWeights.gamePublicationWeight || 0))
  );
}

/**
 * Update all user probabilities.
 * This recalculates final win probabilities based on the 50/50 split.
 */
export async function updateAllProbabilities(): Promise<void> {
  const config = await PayoutConfigModel.findOne().lean();
  const otherWeights = config?.weights || DEFAULT_OTHER_WEIGHTS;

  const users = await UserContributionModel.find();
  if (users.length === 0) return;

  let totalGlobalGitHubRepoPoints = 0;
  let totalGlobalOtherCategoryPoints = 0;

  // First pass: Calculate OtherCategoryPoints for each user and sum up global totals
  for (const user of users) {
    const otherCategoryPoints = calculateOtherCategoryPoints(user.metrics, otherWeights);
    // Store this intermediate calculation in user.metrics.totalPoints for transparency/debugging
    // This field now represents Points_OtherCategory
    user.metrics.totalPoints = otherCategoryPoints;

    totalGlobalGitHubRepoPoints += user.metrics.githubRepoPoints || 0;
    totalGlobalOtherCategoryPoints += otherCategoryPoints;
  }

  // Second pass: Calculate final win probability for each user and save
  const updates = users.map(user => {
    let probFromGitHub = 0;
    if (totalGlobalGitHubRepoPoints > 0 && (user.metrics.githubRepoPoints || 0) > 0) {
      probFromGitHub = (user.metrics.githubRepoPoints || 0) / totalGlobalGitHubRepoPoints;
    }

    let probFromOther = 0;
    if (totalGlobalOtherCategoryPoints > 0 && user.metrics.totalPoints > 0) {
      probFromOther = user.metrics.totalPoints / totalGlobalOtherCategoryPoints;
    }

    let finalWinProbability: number;

    // Determine effective weights for combining probabilities
    const ghHasContributions = totalGlobalGitHubRepoPoints > 0;
    const otherHasContributions = totalGlobalOtherCategoryPoints > 0;

    if (ghHasContributions && otherHasContributions) {
      finalWinProbability = (0.5 * probFromGitHub) + (0.5 * probFromOther);
    } else if (ghHasContributions) { // Only GitHub contributions exist in the system
      finalWinProbability = probFromGitHub;
    } else if (otherHasContributions) { // Only "other" contributions exist
      finalWinProbability = probFromOther;
    } else { // No contributions of any kind, or only one user with no points
      finalWinProbability = users.length > 0 ? 1 / users.length : 0;
    }
    
    // Ensure the sum of probabilities doesn't exceed 1 due to this combined approach
    // This is naturally handled if individual probFromGitHub and probFromOther are correct.

    return UserContributionModel.updateOne(
      { _id: user._id },
      {
        $set: {
          'metrics.totalPoints': user.metrics.totalPoints, // This is Points_OtherCategory
          winProbability: finalWinProbability,
          lastCalculated: new Date()
        }
      }
    );
  });

  await Promise.all(updates);
  console.log("All user win probabilities updated with 50/50 split logic.");
}


export async function getUserWinProbability(userId: string): Promise<number> {
  const user = await UserContributionModel.findOne({ userId });
  if (!user) return 0;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (user.lastCalculated < twentyFourHoursAgo) {
    console.log(`Win probability for ${user.username} is stale, recalculating all...`);
    await updateAllProbabilities();
    const updatedUser = await UserContributionModel.findOne({ userId });
    return updatedUser?.winProbability || 0;
  }

  return user.winProbability;
}

export async function simulatePayouts(amount: number): Promise<Array<{userId: string; username: string; dollars: number}>> {
  const users = await UserContributionModel.find().lean();
  if (users.length === 0) return [];

  const results = users.map(user => ({
    userId: user.userId,
    username: user.username,
    dollars: 0
  }));

  for (let i = 0; i < amount; i++) {
    const winnerIndex = weightedRandomSelection(users.map(u => u.winProbability));
    if (winnerIndex !== -1) {
      results[winnerIndex].dollars += 1;
    }
  }
  return results.sort((a, b) => b.dollars - a.dollars);
}

export async function executePayout(amount: number): Promise<string> {
  const config = await PayoutConfigModel.findOne();
  if (!config || config.totalPool < amount) {
    throw new Error('Insufficient funds in the pool');
  }

  const batchId = uuidv4();
  const users = await UserContributionModel.find();
  if (users.length === 0) {
    console.log("No users found to execute payout.");
    return batchId;
  }
  
  console.log(`Starting payout execution for batch ${batchId} with amount $${amount}`);

  const payoutRecordsPromises = [];
  const stripeTransferPromises = [];
  let successfulPayoutAmount = 0;

  for (let i = 0; i < amount; i++) {
    const winnerIndex = weightedRandomSelection(users.map(u => u.winProbability));
    if (winnerIndex !== -1) {
      const winner = users[winnerIndex];
      console.log(`Dollar ${i+1}/${amount}: Winner selected - ${winner.username} (Prob: ${winner.winProbability.toFixed(6)})`);

      const winnerProfile = await prisma.profile.findUnique({
        where: { userId: winner.userId },
        select: { stripeConnectAccountId: true, stripePayoutsEnabled: true }
      });

      if (winnerProfile && winnerProfile.stripeConnectAccountId && winnerProfile.stripePayoutsEnabled) {
        console.log(`  Attempting Stripe transfer to ${winnerProfile.stripeConnectAccountId} for ${winner.username}`);
        stripeTransferPromises.push(
          stripe.transfers.create({
            amount: 100, // $1.00 in cents
            currency: "usd",
            destination: winnerProfile.stripeConnectAccountId,
            transfer_group: batchId,
            description: `Random Playables Payout - Batch ${batchId} - User ${winner.username}`,
            metadata: {
                userId: winner.userId,
                username: winner.username,
                batchId: batchId
            }
          }).then(transfer => {
            console.log(`  Stripe transfer successful for ${winner.username}, Transfer ID: ${transfer.id}`);
            successfulPayoutAmount += 1;
            payoutRecordsPromises.push(
              PayoutRecordModel.create({
                batchId,
                userId: winner.userId,
                username: winner.username,
                amount: 1,
                probability: winner.winProbability,
                timestamp: new Date(),
                stripeTransferId: transfer.id,
                status: 'completed',
              })
            );
            return UserContributionModel.updateOne(
              { userId: winner.userId },
              { $inc: { winCount: 1 } }
            );
          }).catch(err => {
            console.error(`  Stripe transfer FAILED for ${winner.username} (Stripe ID: ${winnerProfile.stripeConnectAccountId}):`, err.message);
            payoutRecordsPromises.push(
              PayoutRecordModel.create({
                batchId,
                userId: winner.userId,
                username: winner.username,
                amount: 1,
                probability: winner.winProbability,
                timestamp: new Date(),
                status: 'failed',
                stripeError: err.message,
              })
            );
          })
        );
      } else {
        let reason = "No Stripe Connect account configured.";
        if (winnerProfile && winnerProfile.stripeConnectAccountId && !winnerProfile.stripePayoutsEnabled) {
            reason = "Stripe account connected but payouts not enabled.";
        }
        console.warn(`  User ${winner.username} (${winner.userId}) won but payout cannot be processed: ${reason}`);
        payoutRecordsPromises.push(
           PayoutRecordModel.create({
              batchId,
              userId: winner.userId,
              username: winner.username,
              amount: 1,
              probability: winner.winProbability,
              timestamp: new Date(),
              status: 'requires_stripe_setup',
           })
        );
      }
    } else {
        console.log(`Dollar ${i+1}/${amount}: No winner selected (total probability less than 1 or error).`);
    }
  }

  await Promise.allSettled(stripeTransferPromises);
  await Promise.all(payoutRecordsPromises);
  console.log(`Payout execution for batch ${batchId} completed. Successfully transferred $${successfulPayoutAmount}.`);

  if (successfulPayoutAmount > 0) {
    await PayoutConfigModel.updateOne(
      { _id: config._id },
      {
        $inc: { totalPool: -successfulPayoutAmount },
        $set: { lastUpdated: new Date() }
      }
    );
    console.log(`Updated totalPool. New pool size: ${config.totalPool - successfulPayoutAmount}`);
  }


  return batchId;
}

export async function getUserPayoutHistory(userId: string): Promise<{
  totalAmount: number;
  recentPayouts: Array<{ amount: number; timestamp: Date, status?: string, stripeTransferId?: string }>
}> {
  const payouts = await PayoutRecordModel.find({ userId })
                    .sort({ timestamp: -1 })
                    .limit(100)
                    .lean(); // Use .lean() for performance if not modifying

  const totalAmount = payouts.reduce((sum, payout) => payout.status === 'completed' ? sum + payout.amount : sum, 0);

  const recentPayouts = payouts.map(payout => ({
    amount: payout.amount,
    timestamp: payout.timestamp,
    status: payout.status,
    stripeTransferId: payout.stripeTransferId
  }));

  return { totalAmount, recentPayouts };
}

function weightedRandomSelection(weights: number[]): number {
  const totalWeight = weights.reduce((sum, weight) => sum + (weight || 0), 0);
  if (totalWeight <= 0) return -1; // Handle cases where no weights or all are zero

  let random = Math.random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    if (random < (weights[i] || 0)) {
      return i;
    }
    random -= (weights[i] || 0);
  }
  // Fallback, should ideally not be reached if totalWeight > 0
  // Can happen with floating point inaccuracies if random is extremely close to totalWeight
  // Or if weights array has issues.
  // For safety, return the last index if it's a valid scenario, or -1 if something is wrong.
  // Consider logging an anomaly if this path is hit frequently.
  return weights.length > 0 ? weights.length -1 : -1;
}