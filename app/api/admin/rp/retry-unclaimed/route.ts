import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { PayoutRecordModel, UserContributionModel, PayoutConfigModel } from "@/models/RandomPayables";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  const clerkUser = await currentUser();
  if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();
    console.log("[Admin Retry] Starting manual payout retry job...");

    const now = new Date();
    
    // Step 1: Expire old, unclaimed payouts
    const expireResult = await PayoutRecordModel.updateMany(
      { 
        status: 'requires_stripe_setup',
        expiresAt: { $lte: now }
      },
      { $set: { status: 'expired' } },
      { session }
    );
    if (expireResult.modifiedCount > 0) {
      console.log(`[Admin Retry] Expired ${expireResult.modifiedCount} unclaimed payout(s).`);
    }

    // Step 2: Find pending payouts that haven't expired
    const retriablePayouts = await PayoutRecordModel.find({
      status: 'requires_stripe_setup',
      expiresAt: { $gt: now }
    }).session(session);

    if (retriablePayouts.length === 0) {
      console.log("[Admin Retry] No retriable payouts found.");
      await session.commitTransaction();
      return NextResponse.json({ success: true, message: "No pending payouts to retry." });
    }

    console.log(`[Admin Retry] Found ${retriablePayouts.length} payout(s) to retry.`);
    let successfulRetries = 0;
    let failedRetries = 0;

    for (const payout of retriablePayouts) {
      const userProfile = await prisma.profile.findUnique({
        where: { userId: payout.userId },
        select: { stripeConnectAccountId: true, stripePayoutsEnabled: true },
      });

      if (userProfile && userProfile.stripeConnectAccountId && userProfile.stripePayoutsEnabled) {
        console.log(`[Admin Retry] User ${payout.username} is now eligible. Attempting transfer...`);
        try {
          const transfer = await stripe.transfers.create({
            amount: payout.amount * 100,
            currency: "usd",
            destination: userProfile.stripeConnectAccountId,
            transfer_group: `retry-${payout.batchId}`,
            description: `Retry Payout for ${payout.username} from Batch ${payout.batchId}`,
            metadata: {
                userId: payout.userId,
                username: payout.username,
                originalBatchId: payout.batchId,
                payoutRecordId: String(payout._id)
            }
          });

          payout.status = 'completed';
          payout.stripeTransferId = transfer.id;
          payout.expiresAt = undefined;
          await payout.save({ session });
          
          await UserContributionModel.updateOne(
            { userId: payout.userId }, { $inc: { winCount: payout.amount } }, { session }
          );

          await PayoutConfigModel.updateOne(
            {}, { $inc: { totalPool: -payout.amount } }, { session }
          );

          successfulRetries++;
          console.log(`[Admin Retry] Successfully paid $${payout.amount} to ${payout.username}.`);

        } catch (stripeError: any) {
          failedRetries++;
          console.error(`[Admin Retry] Stripe transfer failed for ${payout.username}:`, stripeError.message);
          payout.stripeError = stripeError.message;
          await payout.save({ session });
        }
      }
    }

    await session.commitTransaction();
    const message = `Retry process finished. Paid out ${successfulRetries} user(s). ${failedRetries} payment(s) failed. ${expireResult.modifiedCount} payout(s) expired.`;
    console.log(`[Admin Retry] ${message}`);
    return NextResponse.json({ success: true, message });

  } catch (error: any) {
    await session.abortTransaction();
    console.error("[Admin Retry] Payout retry job failed:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  } finally {
    session.endSession();
  }
}