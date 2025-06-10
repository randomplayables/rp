import { NextRequest, NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import mongoose from "mongoose";

// Import all necessary models from MongoDB
import AnswerModel from "@/models/Answer";
import GameDataModel from "@/models/GameData";
import GameSessionModel from "@/models/GameSession";
import GitHubIntegrationModel from "@/models/GitHubIntegration";
import QuestionModel from "@/models/Question";
import { UserContributionModel, PayoutRecordModel } from "@/models/RandomPayables";
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";
import UserInstrumentModel from "@/models/UserInstrument";
import UserSketchModel from "@/models/UserSketch";
import UserVisualizationModel from "@/models/UserVisualization";

export async function POST(request: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = clerkUser.id;
        console.log(`[Disconnect] Starting account disconnection for user ID: ${userId}`);

        // --- Handle Stripe Subscription and Customer Deletion ---
        const profile = await prisma.profile.findUnique({
            where: { userId },
            select: { stripeSubscriptionId: true }
        });

        if (profile && profile.stripeSubscriptionId) {
            try {
                // Retrieve the subscription to get the customer ID
                const subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId);
                const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

                // 1. Cancel the subscription
                console.log(`[Disconnect] Cancelling Stripe subscription: ${profile.stripeSubscriptionId} for user: ${userId}`);
                await stripe.subscriptions.cancel(profile.stripeSubscriptionId);
                console.log(`[Disconnect] Successfully cancelled Stripe subscription.`);

                // 2. Delete the customer
                if (customerId) {
                    console.log(`[Disconnect] Deleting Stripe customer: ${customerId}`);
                    await stripe.customers.del(customerId);
                    console.log(`[Disconnect] Successfully deleted Stripe customer.`);
                }

            } catch (stripeError: any) {
                // Log the error but don't block account deletion, as the subscription/customer might already be inactive or deleted.
                console.error(`[Disconnect] Stripe subscription/customer cleanup failed for user ${userId}. Error: ${stripeError.message}. Proceeding with platform account deletion.`);
            }
        }
        
        // Connect to MongoDB
        await connectToDatabase();
        console.log(`[Disconnect] Connected to MongoDB for user: ${userId}`);

        // Perform all MongoDB deletions and anonymizations
        const mongoDeletions = [
            // Anonymize community content
            AnswerModel.updateMany({ userId }, { $set: { userId: null, username: 'deleted_user' } }),
            QuestionModel.updateMany({ userId }, { $set: { userId: null, username: 'deleted_user' } }),
            
            // Delete user-owned content and integrations
            SurveyModel.deleteMany({ userId }),
            UserInstrumentModel.deleteMany({ userId }),
            UserSketchModel.deleteMany({ userId }),
            UserVisualizationModel.deleteMany({ userId }),
            GitHubIntegrationModel.deleteOne({ userId }),
            UserContributionModel.deleteOne({ userId }),

            // Anonymize other interaction data
            GameDataModel.updateMany({ userId }, { $set: { userId: null, username: 'deleted_user' } }),
            GameSessionModel.updateMany({ userId }, { $set: { userId: null, username: 'deleted_user' } }),
            SurveyResponseModel.updateMany({ respondentId: userId }, { $set: { respondentId: null } }),
            PayoutRecordModel.updateMany({ userId }, { $set: { username: 'deleted_user' } })
        ];

        const mongoResults = await Promise.allSettled(mongoDeletions);
        console.log(`[Disconnect] MongoDB data removal process completed for user: ${userId}`);
        mongoResults.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.error(`[Disconnect] MongoDB action #${i} failed for user ${userId}:`, result.reason);
                // Throw an error to stop the process if a critical action fails
                throw new Error(`Failed to process a portion of MongoDB data. Aborting disconnection.`);
            }
        });

        // Perform Prisma (PostgreSQL) deletions in a transaction
        console.log(`[Disconnect] Starting Prisma data removal for user: ${userId}`);
        await prisma.$transaction([
            prisma.apiUsage.deleteMany({ where: { userId } }),
            prisma.profile.deleteMany({ where: { userId } })
        ]);
        console.log(`[Disconnect] Prisma data removal completed for user: ${userId}`);

        // Delete the user from Clerk - THIS IS THE FINAL STEP
        console.log(`[Disconnect] Deleting user from Clerk: ${userId}`);
        await (await clerkClient()).users.deleteUser(userId);
        console.log(`[Disconnect] Successfully deleted user from Clerk: ${userId}`);

        // Return success response
        return NextResponse.json({ success: true, message: "Account disconnected successfully." });

    } catch (error: any) {
        console.error("[Disconnect] Error during account disconnection:", error);
        return NextResponse.json({
            error: "An error occurred during account disconnection. Please try again or contact support if the issue persists.",
            details: error.message
        }, { status: 500 });
    }
}