import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserContributionModel, PointTransferModel, IUserContribution, ContributionMetrics } from "@/models/RandomPayables";
import { prisma } from "@/lib/prisma";
import { updateAllProbabilities } from "@/lib/payablesEngine";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const clerkUser = await currentUser();
    if (!clerkUser?.id || !clerkUser.username) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientUsername, amount, memo, pointType } = await request.json();

    if (!recipientUsername || !amount || !pointType) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Recipient, amount, and point type are required." }, { status: 400 });
    }
    
    const allowedPointTypes = ['githubRepoPoints', 'peerReviewPoints', 'totalPoints'];
    if (!allowedPointTypes.includes(pointType)) {
        await session.abortTransaction();
        return NextResponse.json({ error: "Invalid point type specified." }, { status: 400 });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }
    
    if (recipientUsername.toLowerCase() === clerkUser.username.toLowerCase()) {
      await session.abortTransaction();
      return NextResponse.json({ error: "You cannot transfer points to yourself." }, { status: 400 });
    }

    await connectToDatabase();

    const recipientProfile = await prisma.profile.findUnique({
      where: { username: recipientUsername },
    });

    if (!recipientProfile) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Recipient user not found." }, { status: 404 });
    }
    const recipientUserId = recipientProfile.userId;

    const sender = await UserContributionModel.findOne({ userId: clerkUser.id }).session(session);
    
    const senderBalance = sender?.metrics?.[pointType as keyof ContributionMetrics] || 0;

    if (!sender || senderBalance < transferAmount) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Insufficient points in the selected category." }, { status: 400 });
    }

    const balanceField = `metrics.${pointType}`;

    // 1. Decrement sender's points
    await UserContributionModel.updateOne(
        { userId: clerkUser.id },
        { $inc: { [balanceField]: -transferAmount } },
        { session }
    );

    // 2. Increment recipient's points
    await UserContributionModel.updateOne(
      { userId: recipientUserId },
      { 
        $inc: { [balanceField]: transferAmount },
        $setOnInsert: {
          userId: recipientUserId,
          username: recipientProfile.username,
        }
      },
      { upsert: true, session }
    );

    // 3. Create a record of the transfer
    await PointTransferModel.create([{
      senderUserId: clerkUser.id,
      senderUsername: clerkUser.username,
      recipientUserId: recipientUserId,
      recipientUsername: recipientProfile.username,
      amount: transferAmount,
      memo: memo,
      pointType: pointType,
    }], { session });

    await session.commitTransaction();
    
    updateAllProbabilities().catch(err => {
        console.error("Failed to update probabilities after transfer:", err);
    });

    return NextResponse.json({ success: true, message: "Points transferred successfully." });

  } catch (error: any) {
    await session.abortTransaction();
    console.error("Point transfer error:", error);
    return NextResponse.json({
      error: "Failed to transfer points",
      details: error.message
    }, { status: 500 });
  } finally {
    session.endSession();
  }
}