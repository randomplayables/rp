import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
    try {
        const {searchParams} = new URL(request.url)
        const userId = searchParams.get("userId")
        console.log(`⭐ CHECK SUBSCRIPTION: Checking for userId: ${userId}`);

        if (!userId) {
            console.log("⭐ CHECK SUBSCRIPTION: Missing userId");
            return NextResponse.json({error: "Missing userId."}, {status: 400}) 
        }

        const profile = await prisma.profile.findUnique({
            where: {userId}, 
            select: {subscriptionActive: true, subscriptionTier: true, stripeSubscriptionId: true},
        })
        
        console.log(`⭐ CHECK SUBSCRIPTION: Profile data for ${userId}:`, JSON.stringify(profile));

        return NextResponse.json({ 
            subscriptionActive: profile?.subscriptionActive,
            subscriptionTier: profile?.subscriptionTier
        })
    } catch (error: any) {
        console.error(`⭐ CHECK SUBSCRIPTION: Error:`, error.message);
        return NextResponse.json({error: "Internal Error."}, {status: 500})
    }
}