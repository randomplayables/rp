import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GauntletChallengeModel, IGauntletParticipant } from "@/models/Gauntlet";
import { UserContributionModel } from "@/models/RandomPayables";

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

    const { gameId, wager, opponentWager, setupConfig, lockedSettings, team } = await request.json();

    if (!gameId || !wager || !opponentWager || !setupConfig || !team) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Check if user has enough points
    const userContribution = await UserContributionModel.findOne({ userId: clerkUser.id });
    if (!userContribution || userContribution.metrics.totalPoints < wager) {
        return NextResponse.json({ error: "Insufficient points for this wager." }, { status: 400 });
    }

    // Deduct points from challenger
    await UserContributionModel.updateOne(
        { userId: clerkUser.id },
        { $inc: { 'metrics.totalPoints': -wager } }
    );

    const challenger: IGauntletParticipant = {
      userId: clerkUser.id,
      username: clerkUser.username,
      team,
      wager,
      setupConfig,
      hasSetup: true,
    } as IGauntletParticipant;

    const challenge = await GauntletChallengeModel.create({
      gameId,
      challenger,
      opponentWager, // Use the new top-level field
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