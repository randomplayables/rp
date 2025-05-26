import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: clerkUser.id },
      select: {
        subscriptionTier: true,
        stripeSubscriptionId: true,
        subscriptionActive: true,
        stripeConnectAccountId: true,
        stripePayoutsEnabled: true, // Assuming you added this field
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error("Error fetching profile details:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}