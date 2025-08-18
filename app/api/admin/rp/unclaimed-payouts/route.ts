import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PayoutRecordModel } from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        await connectToDatabase();

        const now = new Date();
        const unclaimedPayouts = await PayoutRecordModel.find({
            status: 'requires_stripe_setup',
            expiresAt: { $gt: now } // Only show payouts that haven't expired
        })
        .sort({ expiresAt: 1 }) // Show most urgent first
        .lean();

        return NextResponse.json({ payouts: unclaimedPayouts });

    } catch (error: any) {
        console.error("Error fetching unclaimed payouts:", error);
        return NextResponse.json({ 
            error: "Failed to fetch unclaimed payouts", 
            details: error.message 
        }, { status: 500 });
    }
}