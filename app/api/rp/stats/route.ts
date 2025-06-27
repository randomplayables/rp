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

    // MODIFICATION START: Pass the entire metrics object instead of reconstructing it.
    const topContributors = rawTopContributors.map(c => ({
        username: c.username,
        metrics: c.metrics, // This now includes all fields from the metrics object
        winCount: c.winCount,
        winProbability: c.winProbability,
    }));
    // MODIFICATION END
    
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