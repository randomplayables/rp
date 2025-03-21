import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"


export async function POST() {
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

    const existingProfile = await prisma.profile.findUnique({
        where: {userId: clerkUser.id},
    })

    if(existingProfile) {
        return NextResponse.json(
            {message: "Profile already exists."},
        )
    }
}