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

    if (!profile || !profile.stripeConnectAccountId) {
      return NextResponse.json({ error: "Stripe account not connected." }, { status: 400 });
    }

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripeConnectAccountId
    );

    return NextResponse.json({ url: loginLink.url });

  } catch (error: any) {
    console.error("Stripe create login link error:", error);
    return NextResponse.json({ 
      error: "Failed to create Stripe dashboard link.", 
      details: error.message 
    }, { status: 500 });
  }
}