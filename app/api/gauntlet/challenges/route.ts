// import { NextRequest, NextResponse } from "next/server";
// import { currentUser } from "@clerk/nextjs/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import { GauntletChallengeModel, IGauntletParticipant } from "@/models/Gauntlet";
// import { UserContributionModel } from "@/models/RandomPayables";

// // GET open gauntlet challenges
// export async function GET(request: NextRequest) {
//   try {
//     await connectToDatabase();
//     const challenges = await GauntletChallengeModel.find({ status: 'pending' })
//       .sort({ createdAt: -1 })
//       .lean();
//     return NextResponse.json({ challenges });
//   } catch (error: any) {
//     console.error("Error fetching gauntlet challenges:", error);
//     return NextResponse.json({ error: "Failed to fetch challenges" }, { status: 500 });
//   }
// }

// // POST to create a new gauntlet challenge
// export async function POST(request: NextRequest) {
//   try {
//     const clerkUser = await currentUser();
//     if (!clerkUser || !clerkUser.id || !clerkUser.username) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { gameId, wager, opponentWager, setupConfig, lockedSettings, team } = await request.json();

//     if (!gameId || !wager || !opponentWager || !setupConfig || !team) {
//       return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
//     }
    
//     await connectToDatabase();
    
//     // Check if user has enough points
//     const userContribution = await UserContributionModel.findOne({ userId: clerkUser.id });
//     if (!userContribution || userContribution.metrics.totalPoints < wager) {
//         return NextResponse.json({ error: "Insufficient points for this wager." }, { status: 400 });
//     }

//     // Deduct points from challenger
//     await UserContributionModel.updateOne(
//         { userId: clerkUser.id },
//         { $inc: { 'metrics.totalPoints': -wager } }
//     );

//     const challenger: IGauntletParticipant = {
//       userId: clerkUser.id,
//       username: clerkUser.username,
//       team,
//       wager,
//       setupConfig,
//       hasSetup: true,
//     } as IGauntletParticipant;

//     const challenge = await GauntletChallengeModel.create({
//       gameId,
//       challenger,
//       opponentWager, // Use the new top-level field
//       lockedSettings,
//       status: 'pending'
//     });

//     return NextResponse.json({ success: true, challenge }, { status: 201 });

//   } catch (error: any) {
//     console.error("Error creating gauntlet challenge:", error);
//     // Here you might want to add logic to refund points if the challenge creation fails after deduction
//     return NextResponse.json({ error: "Failed to create challenge" }, { status: 500 });
//   }
// }






import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GauntletChallengeModel, IGauntletParticipant } from "@/models/Gauntlet";
import { UserContributionModel, ContributionMetrics } from "@/models/RandomPayables";
// 🔧 Added: use your existing weighting helpers so escrow reflects weights
import { loadOtherWeights, getWeightedPoints } from "@/lib/payablesEngine";

// GET open gauntlet challenges
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const challenges = await GauntletChallengeModel.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ challenges });
  } catch (error: any) {
    console.error("Error fetching gauntlet challenges:", error);
    return NextResponse.json({ error: "Failed to fetch challenges" }, { status: 500 });
  }
}

// POST to create a new gauntlet challenge
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id || !clerkUser.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId, wager, opponentWager, setupConfig, lockedSettings, team, wagerSubCategory } = await request.json();

    if (!gameId || !wager || !opponentWager || !setupConfig || !team) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const userContribution = await UserContributionModel.findOne({ userId: clerkUser.id });

    if (!userContribution) {
        return NextResponse.json({ error: "Insufficient points for this wager." }, { status: 400 });
    }

    let balanceField: keyof ContributionMetrics = 'totalPoints';
    if (wagerSubCategory) {
        balanceField = wagerSubCategory as keyof ContributionMetrics;
    }

    const userBalance = userContribution.metrics[balanceField] || 0;

    if (userBalance < wager) {
        return NextResponse.json({ error: "Insufficient points in the selected category for this wager." }, { status: 400 });
    }

    // 🔧 ESCROW: deduct from the wagered bucket (unchanged)
    await UserContributionModel.updateOne(
      { userId: clerkUser.id },
      { $inc: { [`metrics.${balanceField}`]: -wager } }
    );

    // 🔧 Minimal fix: if this was a sub-bucket wager, recompute totalPoints using weights
    // (instead of directly decrementing totalPoints by the raw wager)
    if (wagerSubCategory) {
      const refreshed = await UserContributionModel.findOne({ userId: clerkUser.id });
      if (refreshed) {
        const weights = await loadOtherWeights();
        const recomputedTotal = getWeightedPoints(refreshed.metrics as any, weights);
        await UserContributionModel.updateOne(
          { userId: clerkUser.id },
          { $set: { "metrics.totalPoints": recomputedTotal } }
        );
      }
    }

    const challenger: IGauntletParticipant = {
      userId: clerkUser.id,
      username: clerkUser.username,
      team,
      wager,
      wagerSubCategory,
      setupConfig,
      hasSetup: true,
    } as IGauntletParticipant;

    const challenge = await GauntletChallengeModel.create({
      gameId,
      challenger,
      opponentWager,
      wagerSubCategory,
      lockedSettings,
      status: 'pending'
    });

    return NextResponse.json({ success: true, challenge }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating gauntlet challenge:", error);
    // Here you might want to add logic to refund points if the challenge creation fails after deduction
    return NextResponse.json({ error: "Failed to create challenge" }, { status: 500 });
  }
}