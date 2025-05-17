// app/api/rp/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserContributionModel, PayoutRecordModel, PayoutConfigModel } from "@/models/RandomPayables";

/**
 * GET endpoint to retrieve overall system statistics
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Get total contributors
    const totalContributors = await UserContributionModel.countDocuments();
    
    // Get top contributors
    const topContributors = await UserContributionModel.find()
      .sort({ 'metrics.totalPoints': -1 })
      .limit(10)
      .select('username metrics.totalPoints winCount')
      .lean();
    
    // Get total payouts made
    const totalPayoutAmount = await PayoutRecordModel.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    
    // Get latest payouts
    const recentPayouts = await PayoutRecordModel.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .select('username amount timestamp')
      .lean();
    
    // Get config
    const config = await PayoutConfigModel.findOne().lean();
    
    // Compile stats
    const stats = {
      totalContributors,
      totalPaidOut: totalPayoutAmount.length > 0 ? totalPayoutAmount[0].total : 0,
      currentPoolSize: config?.totalPool || 0,
      topContributors,
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