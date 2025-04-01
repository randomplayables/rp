import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"


export async function GET(request: NextRequest) {
    try {
        const {searchParams} = new URL(request.url)
        const userId = searchParams.get("userId")

        if (!userId) {
            return NextResponse.json({error: "Missing userId."}, {status: 400}) 
        }

        const profile = await prisma.profile.findUnique({
            where: {userId}, 
            select: {subscriptionActive: true},
        })

        return NextResponse.json({ subscriptionActive: profile?.subscriptionActive })
    } catch (error: any) {
        return NextResponse.json({error: "Internal Error."}, {status: 500})
    }
}