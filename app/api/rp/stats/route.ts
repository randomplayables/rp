import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserContributionModel, PayoutRecordModel, PayoutConfigModel } from "@/models/RandomPayables";

/**
 * GET endpoint to retrieve overall system statistics
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const totalContributors = await UserContributionModel.countDocuments();
    
    // Fetch raw contributor data including all necessary fields
    const rawTopContributors = await UserContributionModel.find()
      .sort({ winProbability: -1 }) // Sort by actual win probability
      .limit(10)
      // Select username, the whole metrics object, winProbability, and winCount
      .select('username metrics winProbability winCount') 
      .lean();

    // Map to the structure expected by the frontend Stats interface
    const topContributors = rawTopContributors.map(c => ({
        username: c.username,
        metrics: { // For "Other Cat. Points"
            totalPoints: c.metrics.totalPoints 
        },
        winCount: c.winCount,
        winProbability: c.winProbability, // Directly from the model
        githubRepoPoints: c.metrics.githubRepoPoints // From metrics
    }));
    
    const totalPayoutAmountResult = await PayoutRecordModel.aggregate([
      { $match: { status: 'completed' } }, // Only sum completed payouts
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    
    const recentPayouts = await PayoutRecordModel.find({ status: 'completed' })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('username amount timestamp')
      .lean();
    
    const config = await PayoutConfigModel.findOne().lean();
    
    const stats = {
      totalContributors,
      totalPaidOut: totalPayoutAmountResult.length > 0 ? totalPayoutAmountResult[0].total : 0,
      currentPoolSize: config?.totalPool || 0,
      topContributors, // Use the mapped version
      recentPayouts
    };
    
    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error("Error retrieving system stats:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}