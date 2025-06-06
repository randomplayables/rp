// lib/contributionUpdater.ts
import { UserContributionModel } from "@/models/RandomPayables";
import { updateAllProbabilities } from "@/lib/payablesEngine";

export enum ContributionType {
  VISUALIZATION = 'visualization',
  SKETCH = 'sketch',
  INSTRUMENT = 'instrument',
  QUESTION = 'question',
  ANSWER = 'answer',
  BUG_REPORT = 'bug_report'
}

const CONTRIBUTION_POINTS = {
  [ContributionType.VISUALIZATION]: { field: 'contentCreation', points: 8 },
  [ContributionType.SKETCH]: { field: 'codeContributions', points: 10 },
  [ContributionType.INSTRUMENT]: { field: 'contentCreation', points: 8 },
  [ContributionType.QUESTION]: { field: 'communityEngagement', points: 5 },
  [ContributionType.ANSWER]: { field: 'communityEngagement', points: 3 },
  [ContributionType.BUG_REPORT]: { field: 'bugReports', points: 2 }
};

export async function incrementUserContribution(
  userId: string, 
  username: string, 
  contributionType: ContributionType,
  amount: number = 1
) {
  try {
    const config = CONTRIBUTION_POINTS[contributionType];
    if (!config) {
      console.error(`Unknown contribution type: ${contributionType}`);
      return;
    }

    const updateField = `metrics.${config.field}`;
    const incrementValue = config.points * amount;

    // Update or create the user contribution record
    await UserContributionModel.findOneAndUpdate(
      { userId },
      {
        $set: { 
          username, 
          lastCalculated: new Date(),
          updatedAt: new Date()
        },
        $inc: { [updateField]: incrementValue }
      },
      { new: true, upsert: true }
    );

    // Update probabilities asynchronously (don't wait)
    updateAllProbabilities().catch(err => 
      console.error('Error updating probabilities:', err)
    );

  } catch (error) {
    console.error('Error incrementing user contribution:', error);
    // Don't throw - we don't want to break the main operation
  }
}

export async function decrementUserContribution(
  userId: string, 
  contributionType: ContributionType,
  amount: number = 1
) {
  try {
    const config = CONTRIBUTION_POINTS[contributionType];
    if (!config) {
      console.error(`Unknown contribution type: ${contributionType}`);
      return;
    }

    const updateField = `metrics.${config.field}`;
    const decrementValue = -(config.points * amount);

    // Only decrement if it won't go below 0
    await UserContributionModel.findOneAndUpdate(
      { 
        userId,
        [updateField]: { $gte: config.points * amount }
      },
      {
        $set: { 
          lastCalculated: new Date(),
          updatedAt: new Date()
        },
        $inc: { [updateField]: decrementValue }
      }
    );

    // Update probabilities asynchronously
    updateAllProbabilities().catch(err => 
      console.error('Error updating probabilities:', err)
    );

  } catch (error) {
    console.error('Error decrementing user contribution:', error);
  }
}