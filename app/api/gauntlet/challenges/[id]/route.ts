import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GauntletChallengeModel, IGauntletParticipant } from "@/models/Gauntlet";
import { currentUser } from "@clerk/nextjs/server";
import { UserContributionModel } from "@/models/RandomPayables";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const challenge = await GauntletChallengeModel.findById(params.id).lean();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    return NextResponse.json({ challenge });
  } catch (error: any) {
    console.error(`Error fetching gauntlet challenge ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to fetch challenge" }, { status: 500 });
  }
}

// POST to accept a challenge
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser || !clerkUser.id || !clerkUser.username) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();

        const challenge = await GauntletChallengeModel.findById(params.id);
        if (!challenge) {
            return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
        }
        if (challenge.status !== 'pending') {
            return NextResponse.json({ error: "This challenge is no longer open." }, { status: 400 });
        }
        if (challenge.challenger.userId === clerkUser.id) {
            return NextResponse.json({ error: "You cannot challenge yourself." }, { status: 400 });
        }
        
        const opponentWager = challenge.opponent?.wager || 0;
        const userContribution = await UserContributionModel.findOne({ userId: clerkUser.id });

        if (!userContribution || userContribution.metrics.totalPoints < opponentWager) {
            return NextResponse.json({ error: "Insufficient points for this wager." }, { status: 400 });
        }
        
        // Deduct points from opponent
        await UserContributionModel.updateOne(
            { userId: clerkUser.id },
            { $inc: { 'metrics.totalPoints': -opponentWager } }
        );

        // Update challenge with opponent info
        challenge.opponent = {
            userId: clerkUser.id,
            username: clerkUser.username,
            team: challenge.challenger.team === 'A' ? 'B' : 'A',
            wager: opponentWager,
            hasSetup: false, // Opponent still needs to set up their side
        } as IGauntletParticipant;
        challenge.status = 'active';
        
        await challenge.save();
        
        return NextResponse.json({ success: true, challenge });

    } catch (error: any) {
        console.error(`Error accepting gauntlet challenge ${params.id}:`, error);
        return NextResponse.json({ error: "Failed to accept challenge" }, { status: 500 });
    }
}