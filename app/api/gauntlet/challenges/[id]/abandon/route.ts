import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import { UserContributionModel, PointTransferModel } from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";

const GRACE_PERIOD_MS = 60 * 60 * 1000; // 60 minutes

const getIdFromRequest = (request: NextRequest) => {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    return parts[parts.length - 2]; 
};

export async function POST(
    request: NextRequest,
    context: { params: { id: string } }
) {
    const id = getIdFromRequest(request);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!id) {
            throw new Error("Challenge ID not found in URL");
        }

        const clerkUser = await currentUser();
        if (!clerkUser) {
            throw new Error("Unauthorized");
        }

        await connectToDatabase();

        const challenge = await GauntletChallengeModel.findById(id).session(session);

        if (!challenge) {
            throw new Error("Challenge not found");
        }
        
        if (challenge.status !== 'in_progress') {
            await session.abortTransaction();
            return NextResponse.json({ message: "Only in-progress games can be reported." }, { status: 409 });
        }
        
        if (!challenge.startedByUserId || !challenge.startedAt) {
            await session.abortTransaction();
            return NextResponse.json({ message: "Challenge start data is missing." }, { status: 400 });
        }

        if (challenge.startedByUserId === clerkUser.id) {
            await session.abortTransaction();
            return NextResponse.json({ message: "The starter cannot report abandonment." }, { status: 403 });
        }
        
        const gracePeriodEnd = new Date(challenge.startedAt.getTime() + GRACE_PERIOD_MS);
        if (new Date() < gracePeriodEnd) {
            await session.abortTransaction();
            const minutesRemaining = Math.ceil((gracePeriodEnd.getTime() - Date.now()) / 60000);
            return NextResponse.json({ message: `The grace period has not ended. Please wait approximately ${minutesRemaining} more minutes.` }, { status: 400 });
        }

        // Determine winner and loser based on abandonment
        const loserInfo = challenge.challenger.userId === challenge.startedByUserId ? challenge.challenger : challenge.opponent;
        const winnerInfo = challenge.challenger.userId !== challenge.startedByUserId ? challenge.challenger : challenge.opponent;

        if (!winnerInfo || !loserInfo) {
            throw new Error("Could not determine winner and loser from abandonment report.");
        }
        
        const totalWager = winnerInfo.wager + loserInfo.wager;

        // Credit the winner
        await UserContributionModel.updateOne(
            { userId: winnerInfo.userId },
            { $inc: { 'metrics.totalPoints': totalWager } },
            { session, upsert: true }
        );
        
        await PointTransferModel.create([{
            senderUserId: loserInfo.userId,
            senderUsername: loserInfo.username,
            recipientUserId: winnerInfo.userId,
            recipientUsername: winnerInfo.username,
            amount: loserInfo.wager,
            memo: `Gauntlet match forfeit for game: ${challenge.gameId}, challenge: ${challenge._id}`,
            pointType: 'totalPoints',
            context: {
                type: 'GAUNTLET_TRANSFER',
                challengeId: challenge._id
            }
        }], { session });

        // Update the challenge status
        challenge.status = 'completed';
        challenge.winner = winnerInfo.team; // Declare the non-starter as the winner
        challenge.completedAt = new Date();
        await challenge.save({ session });
        
        await session.commitTransaction();
        
        return NextResponse.json({ success: true, message: "Abandonment reported successfully. You have been declared the winner." });

    } catch (error: any) {
        await session.abortTransaction();
        console.error(`Error reporting abandonment for gauntlet challenge ${id}:`, error);
        return NextResponse.json({ error: "Failed to report abandonment", details: error.message }, { status: 500 });
    } finally {
        session.endSession();
    }
}