import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Define the specific handlers for events processed by THIS webhook
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    // (Your existing logic for handleCheckoutSessionCompleted)
    // Get user ID and subscription ID from the session
    const userId = session.metadata?.clerkUserId;
    
    if (!userId) {
      console.error("❌ (Platform Webhook) No user id in session metadata");
      return;
    }
    
    const subscriptionId = session.subscription as string;
    const planType = session.metadata?.planType; // "premium" or "premium_plus"
    
    if (!subscriptionId) {
      console.error("❌ (Platform Webhook) No subscription id in session");
      return;
    }
    
    try {
      console.log(`🔄 (Platform Webhook) Processing subscription for user ${userId}, plan: ${planType}, subId: ${subscriptionId}`);
      
      const existingProfile = await prisma.profile.findUnique({
        where: { userId }
      });
      
      console.log(`🔍 (Platform Webhook) Existing profile found: ${!!existingProfile}`);
      
      if (!existingProfile) {
        console.log(`📝 (Platform Webhook) Creating new profile for user ${userId}`);
        const newProfile = await prisma.profile.create({
          data: {
            userId,
            username: "user_" + userId.substring(0, 8), 
            email: session.customer_details?.email || "unknown@example.com",
            subscriptionTier: planType || null,
            stripeSubscriptionId: subscriptionId,
            subscriptionActive: true,
          }
        });
        console.log(`✅ (Platform Webhook) Created new profile:`, JSON.stringify(newProfile));
      } else {
        console.log(`📝 (Platform Webhook) Updating subscription for user ${userId}`);
        const updatedProfile = await prisma.profile.update({
          where: { userId },
          data: {
            stripeSubscriptionId: subscriptionId,
            subscriptionActive: true,
            subscriptionTier: planType || null
          }
        });
        console.log(`✅ (Platform Webhook) Updated profile:`, JSON.stringify(updatedProfile));
      }
      
      const monthlyLimit = planType === "premium_plus" ? 1500 : (planType === "premium" ? 500 : 100); // Assuming 100 for free/null tier
      
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
      console.log(`✅ (Platform Webhook) Updated API usage for ${userId}`);
      console.log(`✅ (Platform Webhook) Successfully updated subscription for user ${userId} - Plan: ${planType}, SubscriptionID: ${subscriptionId}`);
    } catch (error: any) {
      console.error(`❌ (Platform Webhook) Error updating subscription: ${error.message}`);
      console.error(error.stack);
      throw error; 
    }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    // (Your existing logic for handleInvoicePaymentFailed)
    const subId = invoice.subscription as string;

    if (!subId) {
        console.log("❌ (Platform Webhook) No subscription ID in invoice");
        return;
    }

    let userId: string | undefined;
    try {
        console.log(`🔍 (Platform Webhook) Looking up profile for subscription ID: ${subId}`);
        const profile = await prisma.profile.findUnique({
            where: { stripeSubscriptionId: subId }, 
            select: { userId: true }
        });

        if (!profile?.userId) {
            console.log("❌ (Platform Webhook) No profile found for subscription ID");
            return;
        }
        userId = profile.userId;
        console.log(`✅ (Platform Webhook) Found user ID: ${userId}`);
    } catch(error: any) {
        console.error(`❌ (Platform Webhook) Error finding profile: ${error.message}`);
        return;
    }

    try {
        console.log(`📝 (Platform Webhook) Updating subscription status to inactive for user ${userId}`);
        await prisma.profile.update({
            where: {userId: userId},
            data: { subscriptionActive: false }
        });
        console.log(`✅ (Platform Webhook) Profile updated for ${userId}`);
    } catch(error: any) {
        console.error(`❌ (Platform Webhook) Error updating profile: ${error.message}`);
    }
}

async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
    // (Your existing logic for handleCustomerSubscriptionDeleted)
    const subId = subscription.id;
    console.log(`🔍 (Platform Webhook) Processing subscription deleted: ${subId}`);

    let userId: string | undefined;
    try {
        console.log(`🔍 (Platform Webhook) Looking up profile for subscription ID: ${subId}`);
        const profile = await prisma.profile.findUnique({
            where: { stripeSubscriptionId: subId }, 
            select: { userId: true }
        });

        if (!profile?.userId) {
            console.log("❌ (Platform Webhook) No profile found for subscription ID");
            return;
        }
        userId = profile.userId;
        console.log(`✅ (Platform Webhook) Found user ID: ${userId}`);
    } catch(error: any) {
        console.error(`❌ (Platform Webhook) Error finding profile: ${error.message}`);
        return;
    }

    try {
        console.log(`📝 (Platform Webhook) Removing subscription for user ${userId}`);
        await prisma.profile.update({
            where: {userId: userId},
            data: {
                subscriptionActive: false,
                stripeSubscriptionId: null,
                subscriptionTier: null,
            }
        });
        console.log(`✅ (Platform Webhook) Profile updated for ${userId}`);
    } catch(error: any) {
        console.error(`❌ (Platform Webhook) Error updating profile: ${error.message}`);
    }
}

// Optional: A lean handler for your platform's own account updates, if needed.
async function handlePlatformAccountUpdate(account: Stripe.Account) {
    console.log(`🔔 (Platform Webhook) Platform's own Stripe Account Updated: ${account.id}`);
    // Add any logic here if you need to react to changes in your platform's Stripe account.
    // For instance, if your platform's ability to process payments or receive payouts changes.
    // Most commonly, you'd monitor this directly in the Stripe dashboard.
}


export async function POST(request: NextRequest) {
    console.log("🔔 (Platform Webhook) /api/webhook ENDPOINT HIT - START OF REQUEST 🔔");

    let body;
    try {
        body = await request.text();
        console.log(`🔍 (Platform Webhook) Webhook body length: ${body.length} characters`);
    } catch (error) {
        console.error("❌ (Platform Webhook) Error reading webhook body:", error);
        return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
    }

    const signature = request.headers.get("stripe-signature");
    console.log(`🔑 (Platform Webhook) Stripe signature present: ${!!signature}`);

    // Ensure this uses the PLATFORM webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("❌ (Platform Webhook) STRIPE_WEBHOOK_SECRET is not set in .env.local");
        return NextResponse.json({ error: "Webhook secret for platform events is not configured." }, { status: 500 });
    }
    console.log(`🔐 (Platform Webhook) Webhook secret configured (platform): ${!!webhookSecret}`);

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature || "",
            webhookSecret // Use the platform's webhook secret
        );
        console.log(`✅ (Platform Webhook) Webhook verified! Event type: ${event.type}`);
    } catch (error: any) {
        console.error(`❌ (Platform Webhook) Webhook verification failed:`, error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    try {
        console.log(`🔄 (Platform Webhook) Processing event: ${event.type}`);
        
        switch (event.type) {
            case "checkout.session.completed":
                console.log("💰 (Platform Webhook) Checkout session completed event received");
                await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
                break;
            
            case "invoice.payment_failed":
                console.log("⚠️ (Platform Webhook) Invoice payment failed event received");
                await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                break;
            
            case "customer.subscription.deleted":
                console.log("🗑️ (Platform Webhook) Subscription deleted event received");
                await handleCustomerSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
            
            case "account.updated":
                // This case is for updates to your platform's own Stripe account,
                // or if a connected account event was somehow routed here.
                // The primary handler for connected user account.updated is now in /api/webhook/connect
                const account = event.data.object as Stripe.Account;
                console.log(`🔔 (Platform Webhook) Received account.updated. Account ID: ${account.id}.`);
                // Optionally, check if account.id is your platform's ID vs a connected account ID
                // if (account.id === YOUR_PLATFORM_STRIPE_ACCOUNT_ID) { // You'd need to store/know your platform's Stripe acct_ ID
                //   await handlePlatformAccountUpdate(account);
                // } else {
                //   console.warn(`(Platform Webhook) Received account.updated for an unexpected account ID: ${account.id}. This should ideally be handled by /api/webhook/connect.`);
                // }
                break;
            
            default:
                console.log(`⏩ (Platform Webhook) Unhandled event type: ${event.type}`);
        }
        
        console.log(`✅ (Platform Webhook) Successfully processed event: ${event.type}`);
    } catch(error: any) {
        console.error(`❌ (Platform Webhook) Error processing webhook event:`, error);
        console.error(error.stack);
        return NextResponse.json({error: error.message}, {status: 400});
    }

    return NextResponse.json({ received: true });
}