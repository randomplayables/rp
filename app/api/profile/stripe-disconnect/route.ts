import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: clerkUser.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.stripeConnectAccountId) {
      // User is not connected, nothing to disconnect
      return NextResponse.json({ message: "Stripe account is not connected." });
    }

    // For Express accounts, "disconnecting" from the platform side primarily means
    // clearing the local association. The Stripe account itself continues to exist
    // under your platform's control but will no longer be tied to this user for payouts.
    // You could later implement an admin process to delete unused/orphaned Express accounts
    // from your Stripe dashboard if necessary.

    // Update your local database to remove the association
    await prisma.profile.update({
      where: { userId: clerkUser.id },
      data: {
        stripeConnectAccountId: null,
        stripePayoutsEnabled: false, // Reset this flag
      },
    });

    console.log(`User ${clerkUser.id} disconnected their Stripe Connect account ${profile.stripeConnectAccountId}.`);
    return NextResponse.json({ success: true, message: "Stripe account disconnected successfully." });

  } catch (error: any) {
    console.error("Stripe disconnect error:", error);
    return NextResponse.json({ 
      error: "Failed to disconnect Stripe account", 
      details: error.message 
    }, { status: 500 });
  }
}