import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe"

export async function POST(request: NextRequest) {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature || "",
            webhookSecret
        )

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}