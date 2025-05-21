import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
    console.log("🔔 Webhook received!");

    let body;
    try {
        body = await request.text();
        console.log(`🔍 Webhook body length: ${body.length} characters`);
    } catch (error) {
        console.error("❌ Error reading webhook body:", error);
        return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
    }

    const signature = request.headers.get("stripe-signature");
    console.log(`🔑 Stripe signature present: ${!!signature}`);

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    console.log(`🔐 Webhook secret configured: ${!!webhookSecret}`);

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature || "",
            webhookSecret
        );
        console.log(`✅ Webhook verified! Event type: ${event.type}`);
    } catch (error: any) {
        console.error(`❌ Webhook verification failed:`, error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    try {
        console.log(`🔄 Processing event: ${event.type}`);
        
        switch (event.type) {
            case "checkout.session.completed": {
                console.log("💰 Checkout session completed event received");
                const session = event.data.object as Stripe.Checkout.Session;
                console.log(`📝 Session data:`, JSON.stringify({
                    id: session.id,
                    customerId: session.customer,
                    subscriptionId: session.subscription,
                    metadata: session.metadata,
                    clientReferenceId: session.client_reference_id,
                    paymentStatus: session.payment_status
                }));
                
                await handleCheckoutSessionCompleted(session);
                break;
            }
            case "invoice.payment_failed": {
                console.log("⚠️ Invoice payment failed event received");
                const invoice = event.data.object as Stripe.Invoice;
                console.log(`📝 Invoice data: subscription=${invoice.subscription}, customer=${invoice.customer}`);
                
                await handleInvoicePaymentFailed(invoice);
                break;
            }
            case "customer.subscription.deleted": {
                console.log("🗑️ Subscription deleted event received");
                const subscription = event.data.object as Stripe.Subscription;
                console.log(`📝 Subscription data: id=${subscription.id}, customer=${subscription.customer}`);
                
                await handleCustomerSubscriptionDeleted(subscription);
                break;
            }
            default:
                console.log(`⏩ Unhandled event type: ${event.type}`);
        }
        
        console.log(`✅ Successfully processed event: ${event.type}`);
    } catch(error: any) {
        console.error(`❌ Error processing webhook event:`, error);
        console.error(error.stack);
        return NextResponse.json({error: error.message}, {status: 400});
    }

    return NextResponse.json({ received: true });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.clerkUserId;
    
    if (!userId) {
      console.error("❌ No user id in session metadata");
      return;
    }
    
    const subscriptionId = session.subscription as string;
    const planType = session.metadata?.planType; // "premium" or "premium_plus"
    
    if (!subscriptionId) {
      console.error("❌ No subscription id in session");
      return;
    }
    
    try {
      console.log(`🔄 Processing subscription for user ${userId}, plan: ${planType}, subId: ${subscriptionId}`);
      
      // First check if profile exists
      const existingProfile = await prisma.profile.findUnique({
        where: { userId }
      });
      
      console.log(`🔍 Existing profile found: ${!!existingProfile}`);
      
      if (!existingProfile) {
        console.log(`📝 Creating new profile for user ${userId}`);
        // Create profile if it doesn't exist
        const newProfile = await prisma.profile.create({
          data: {
            userId,
            username: "user_" + userId.substring(0, 8), // Generate username
            email: session.customer_details?.email || "unknown@example.com",
            subscriptionTier: planType || null,
            stripeSubscriptionId: subscriptionId,
            subscriptionActive: true,
          }
        });
        console.log(`✅ Created new profile:`, JSON.stringify(newProfile));
      } else {
        // Update existing profile
        console.log(`📝 Updating subscription for user ${userId}`);
        const updatedProfile = await prisma.profile.update({
          where: { userId },
          data: {
            stripeSubscriptionId: subscriptionId,
            subscriptionActive: true,
            subscriptionTier: planType || null
          }
        });
        console.log(`✅ Updated profile:`, JSON.stringify(updatedProfile));
      }
      
      // Create or update API usage limits
      const monthlyLimit = planType === "premium_plus" ? 1500 : 500;
      
      const apiUsage = await prisma.apiUsage.upsert({
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
      console.log(`✅ Updated API usage:`, JSON.stringify(apiUsage));
      
      console.log(`✅ Successfully updated subscription for user ${userId} - Plan: ${planType}, SubscriptionID: ${subscriptionId}`);
    } catch (error: any) {
      console.error(`❌ Error updating subscription: ${error.message}`);
      console.error(error.stack);
      throw error; // Re-throw to make the webhook fail
    }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subId = invoice.subscription as string;

    if (!subId) {
        console.log("❌ No subscription ID in invoice");
        return;
    }

    let userId: string | undefined;
    try {
        console.log(`🔍 Looking up profile for subscription ID: ${subId}`);
        const profile = await prisma.profile.findUnique({
            where: {
                stripeSubscriptionId: subId
            }, 
            select: {
                userId: true
            }
        });

        if (!profile?.userId) {
            console.log("❌ No profile found for subscription ID");
            return;
        }
        userId = profile.userId;
        console.log(`✅ Found user ID: ${userId}`);
    } catch(error: any) {
        console.error(`❌ Error finding profile: ${error.message}`);
        return;
    }

    try {
        console.log(`📝 Updating subscription status to inactive for user ${userId}`);
        const updatedProfile = await prisma.profile.update({
            where: {userId: userId},
            data: {
                subscriptionActive: false,
            }
        });
        console.log(`✅ Updated profile:`, JSON.stringify(updatedProfile));
    } catch(error: any) {
        console.error(`❌ Error updating profile: ${error.message}`);
    }
}

async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
    const subId = subscription.id;
    console.log(`🔍 Processing subscription deleted: ${subId}`);

    // Find the profile
    let userId: string | undefined;
    try {
        console.log(`🔍 Looking up profile for subscription ID: ${subId}`);
        const profile = await prisma.profile.findUnique({
            where: {
                stripeSubscriptionId: subId
            }, 
            select: {
                userId: true
            }
        });

        if (!profile?.userId) {
            console.log("❌ No profile found for subscription ID");
            return;
        }
        userId = profile.userId;
        console.log(`✅ Found user ID: ${userId}`);
    } catch(error: any) {
        console.error(`❌ Error finding profile: ${error.message}`);
        return;
    }

    // Update the profile
    try {
        console.log(`📝 Removing subscription for user ${userId}`);
        const updatedProfile = await prisma.profile.update({
            where: {userId: userId},
            data: {
                subscriptionActive: false,
                stripeSubscriptionId: null,
                subscriptionTier: null,
            }
        });
        console.log(`✅ Updated profile:`, JSON.stringify(updatedProfile));
    } catch(error: any) {
        console.error(`❌ Error updating profile: ${error.message}`);
    }
}