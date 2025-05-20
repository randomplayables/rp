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

        // Get the username from Clerk
        const username = clerkUser.username
        if(!username) {
            return NextResponse.json(
                {error: "User does not have a username"},
                {status: 400}
            )
        }

        const existingProfile = await prisma.profile.findUnique({
            where: {userId: clerkUser.id},
        })

        if(existingProfile) {
            return NextResponse.json(
                {message: "Profile already exists."}
            )
        }

        await prisma.profile.create({
            data: {
                userId: clerkUser.id,
                username, // Save the username from Clerk
                email,
                subscriptionTier: null,
                stripeSubscriptionId: null,
                subscriptionActive: false,
            }
        })

        return NextResponse.json(
            {message: "Profile created successfully."}, 
            {status: 201}
        )
    } catch(error: any){
        // return NextResponse.json({error: "internal error"}, {status: 500})
        console.error("Profile creation error:", error);
        return NextResponse.json({
          error: "internal error", 
          details: error.message
        }, {status: 500})
    }
}