import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import { UserContributionModel } from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";

const getIdFromRequest = (request: NextRequest) => {
    const pathname = new URL(request.url).pathname;
    // Pathname will be /api/gauntlet/challenges/[id]/cancel
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
        
        if (challenge.status !== 'pending') {
            await session.abortTransaction();
            return NextResponse.json({ message: "Only pending challenges can be cancelled." }, { status: 409 }); // 409 Conflict
        }

        if (challenge.challenger.userId !== clerkUser.id) {
            throw new Error("Only the challenger can cancel this challenge.");
        }
        
        // Refund the challenger's wager
        await UserContributionModel.updateOne(
            { userId: challenge.challenger.userId },
            { $inc: { 'metrics.totalPoints': challenge.challenger.wager } },
            { session }
        );
        
        // Update the challenge status to 'cancelled'
        challenge.status = 'cancelled';
        await challenge.save({ session });
        
        await session.commitTransaction();
        
        return NextResponse.json({ success: true, message: "Challenge cancelled and points refunded." });

    } catch (error: any) {
        await session.abortTransaction();
        console.error(`Error cancelling gauntlet challenge ${id}:`, error);
        return NextResponse.json({ error: "Failed to cancel challenge", details: error.message }, { status: 500 });
    } finally {
        session.endSession();
    }
}