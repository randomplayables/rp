import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"


export async function GET() {
    try {
        const clerkUser = await currentUser()
        if (!clerkUser?.id) {
            return NextResponse.json({error: "Unauthorized"})
        }

        const profile = await prisma?.profile.findUnique({
            where: { userId: clerkUser.id},
            select: { subscriptionTier: true },
        })

        if (!profile) {
            return NextResponse.json({ error: "No Profile Found"})
        }

        return NextResponse.json({ subscription: profile })

    } catch (error: any) {
        return NextResponse.json({error: "Internal Error"}, {status: 500})
    }
}