import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    // Public profile data request
    if (username) {
        const profile = await prisma.profile.findUnique({
            where: { username },
            select: {
                username: true,
                imageUrl: true,
                aboutMe: true,
                links: true
            }
        });

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }
        return NextResponse.json({ profile });
    }

    // Private profile data request
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
        stripePayoutsEnabled: true,
        aboutMe: true,
        links: true,
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

export async function PUT(request: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { aboutMe, links } = await request.json();

        const updatedProfile = await prisma.profile.update({
            where: { userId: clerkUser.id },
            data: {
                aboutMe,
                links
            }
        });

        return NextResponse.json({ success: true, profile: updatedProfile });

    } catch (error: any) {
        console.error("Error updating profile details:", error);
        return NextResponse.json({ error: "Failed to update profile", details: error.message }, { status: 500 });
    }
}