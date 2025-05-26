import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
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

    let accountId = profile.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: clerkUser.emailAddresses[0]?.emailAddress,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual', // Assuming contributors are individuals
         // You might need to collect country based on user profile
        country: 'US', // Default or from user profile
      });
      accountId = account.id;
      await prisma.profile.update({
        where: { userId: clerkUser.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile`, // Or your payout settings page
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?stripe_setup_complete=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error: any) {
    console.error("Stripe Connect onboarding error:", error);
    return NextResponse.json({ error: "Failed to set up payouts", details: error.message }, { status: 500 });
  }
}