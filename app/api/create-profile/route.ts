import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"

export async function POST() {
    try {
        const clerkUser = await currentUser()
        if(!clerkUser) {
            return NextResponse.json(
                {error: "User not found in Clerk"},
                {status: 404}
            )
        }

        const email = clerkUser.emailAddresses[0].emailAddress
        if(!email) {
            return NextResponse.json(
                {error: "User does not have an email address"},
                {status: 400}
            )
        }

        const username = clerkUser.username
        if(!username) {
            return NextResponse.json(
                {error: "User does not have a username"},
                {status: 400}
            )
        }

        // Use upsert to handle cases where the webhook might have already created the profile
        await prisma.profile.upsert({
            where: { userId: clerkUser.id },
            update: {
                username,
                email,
                imageUrl: clerkUser.imageUrl,
            },
            create: {
                userId: clerkUser.id,
                username,
                email,
                imageUrl: clerkUser.imageUrl,
                subscriptionActive: false,
                subscriptionTier: null,
                stripeSubscriptionId: null,
            }
        });

        return NextResponse.json(
            {message: "Profile created or updated successfully."}, 
            {status: 201}
        )
    } catch(error: any){
        console.error("Profile creation/update error:", error);
        return NextResponse.json({
          error: "internal error", 
          details: error.message
        }, {status: 500})
    }
}