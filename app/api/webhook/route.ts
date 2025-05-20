import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

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

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session
                await handleCheckoutSessionCompleted(session)
                break
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice
                await handleInvoicePaymentFailed(invoice)
                break
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription
                await handleCustomerSubscriptionDeleted(subscription)
                break
            }
            default:
                console.log("Unhandled event type" + event.type)
        }
    } catch(error: any) {
        return NextResponse.json({error: error.message}, {status: 400})
    }

    return NextResponse.json({})
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.clerkUserId;
    
    if (!userId) {
      console.error("No user id in session metadata");
      return;
    }
    
    const subscriptionId = session.subscription as string;
    const planType = session.metadata?.planType; // "premium" or "premium_plus"
    
    if (!subscriptionId) {
      console.error("No subscription id in session");
      return;
    }
    
    try {
      // First check if profile exists
      const existingProfile = await prisma.profile.findUnique({
        where: { userId }
      });
      
      if (!existingProfile) {
        console.error(`Profile for user ${userId} not found, creating one`);
        // Create profile if it doesn't exist
        await prisma.profile.create({
          data: {
            userId,
            username: "user_" + userId.substring(0, 8), // Generate temporary username
            email: session.customer_details?.email || "unknown@example.com",
            subscriptionTier: planType || null,
            stripeSubscriptionId: subscriptionId,
            subscriptionActive: true,
          }
        });
      } else {
        // Update existing profile
        console.log(`Updating subscription for user ${userId}`);
        await prisma.profile.update({
          where: { userId },
          data: {
            stripeSubscriptionId: subscriptionId,
            subscriptionActive: true,
            subscriptionTier: planType || null
          }
        });
      }
    
      // Create or update API usage limits
      const monthlyLimit = planType === "premium_plus" ? 1500 : 500;
      
      await prisma.apiUsage.upsert({
        where: { userId },
        update: {
          monthlyLimit,
          lastResetDate: new Date()
        },
        create: {
          userId,
          usageCount: 0,
          monthlyLimit,
          lastResetDate: new Date()
        }
      });
      
      console.log(`Successfully updated subscription for user ${userId} - Plan: ${planType}, SubscriptionID: ${subscriptionId}`);
    } catch (error: any) {
      console.error(`Error updating subscription: ${error.message}`);
      console.error(error.stack);
      throw error; // Re-throw to make the webhook fail
    }
  }

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subId = invoice.subscription as string

    if (!subId) {
        return
    }

    let userId: string | undefined
    try {
        const profile = await prisma.profile.findUnique({
            where: {
                stripeSubscriptionId: subId
            }, select: {
                userId: true
            }
        })

        if (!profile?.userId) {
            console.log("No profile found")
            return
        }
        userId = profile.userId
    } catch(error: any) {
        console.log(error.message)
        return
    }

    try {
        await prisma.profile.update({
            where: {userId: userId},
            data: {
                subscriptionActive: false,
            }
        })
    } catch(error: any) {
        console.log(error.message)
    }
    
}

async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
    const subId = subscription.id

    let userId: string | undefined
    try {
        const profile = await prisma.profile.findUnique({
            where: {
                stripeSubscriptionId: subId
            }, select: {
                userId: true
            }
        })

        if (!profile?.userId) {
            console.log("No profile found")
            return
        }
        userId = profile.userId
    } catch(error: any) {
        console.log(error.message)
        return
    }

    try {
        await prisma.profile.update({
            where: {userId: userId},
            data: {
                subscriptionActive: false,
                stripeSubscriptionId: null,
                subscriptionTier: null,
            }
        })
    } catch(error: any) {
        console.log(error.message)
    }
}