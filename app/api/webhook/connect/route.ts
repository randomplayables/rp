// import { NextRequest, NextResponse } from "next/server";
// import Stripe from "stripe";
// import { stripe } from "@/lib/stripe"; // Assuming this is your initialized Stripe client
// import { prisma } from "@/lib/prisma"; // Assuming this is your Prisma client

// // This is the enhanced handleAccountUpdated function we discussed
// async function handleAccountUpdated(account: Stripe.Account) {
//     console.log(`🔔 (Connect Webhook) RAW Stripe Account Updated Event Data: ${JSON.stringify(account, null, 2)}`);

//     const connectAccountId = account.id;
//     console.log(`🔍 (Connect Webhook) Processing account.updated for Connect Account ID: ${connectAccountId}`);

//     const associatedProfile = await prisma.profile.findFirst({
//         where: { stripeConnectAccountId: connectAccountId }
//     });

//     if (associatedProfile) {
//         const payoutsEnabledStatusFromStripe = account.payouts_enabled ?? false;
//         const detailsSubmittedStatusFromStripe = account.details_submitted ?? false;

//         console.log(`ℹ️ (Connect Webhook) For Connect Account ID ${connectAccountId}:`);
//         console.log(`    Stripe payouts_enabled status: ${payoutsEnabledStatusFromStripe}`);
//         console.log(`    Stripe details_submitted status: ${detailsSubmittedStatusFromStripe}`);
//         console.log(`    Profile found in DB: ${associatedProfile.id} (User ID: ${associatedProfile.userId})`);

//         const newStripePayoutsEnabledState = payoutsEnabledStatusFromStripe;

//         await prisma.profile.update({
//             where: { id: associatedProfile.id },
//             data: {
//                 stripePayoutsEnabled: newStripePayoutsEnabledState,
//             }
//         });
//         console.log(`✅ (Connect Webhook) Successfully updated profile for Stripe Connect account ${connectAccountId}. New stripePayoutsEnabled state: ${newStripePayoutsEnabledState}`);
//     } else {
//         console.warn(`⚠️ (Connect Webhook) No profile found in your database for Stripe Connect Account ID: ${connectAccountId}.`);
//     }
// }

// export async function POST(request: NextRequest) {
//     console.log("🟢 (Connect Webhook) /api/webhook/connect ENDPOINT HIT - START OF REQUEST 🟢");

//     let body;
//     try {
//         body = await request.text();
//         console.log(`🔍 (Connect Webhook) Body length: ${body.length} characters`);
//     } catch (error) {
//         console.error("❌ (Connect Webhook) Error reading request body:", error);
//         return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
//     }

//     const signature = request.headers.get("stripe-signature");
//     console.log(`🔑 (Connect Webhook) Stripe signature present: ${!!signature}`);

//     // Use the specific secret for Connect webhooks
//     const webhookSecret = process.env.STRIPE_WEBHOOK_CONNECT_SECRET;
//     if (!webhookSecret) {
//         console.error("❌ (Connect Webhook) STRIPE_WEBHOOK_CONNECT_SECRET is not set.");
//         return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
//     }
//     console.log(`🔐 (Connect Webhook) Webhook secret configured (connect): ${!!webhookSecret}`);

//     let event: Stripe.Event;

//     try {
//         event = stripe.webhooks.constructEvent(
//             body,
//             signature || "",
//             webhookSecret
//         );
//         console.log(`✅ (Connect Webhook) Verified! Event type: ${event.type}`);
//     } catch (error: any) {
//         console.error(`❌ (Connect Webhook) Verification failed:`, error.message);
//         return NextResponse.json({ error: error.message }, { status: 400 });
//     }

//     try {
//         console.log(`🔄 (Connect Webhook) Processing event: ${event.type}`);
        
//         switch (event.type) {
//             case "account.updated": {
//                 const account = event.data.object as Stripe.Account;
//                 console.log(`🔔 (Connect Webhook) Stripe Account Updated: ${account.id}, Payouts Enabled: ${account.payouts_enabled}, Details Submitted: ${account.details_submitted}`);
//                 await handleAccountUpdated(account);
//                 break;
//             }
//             // Add other Connect-specific events here if needed in the future
//             default:
//                 console.log(`⏩ (Connect Webhook) Unhandled event type: ${event.type}`);
//         }
        
//         console.log(`✅ (Connect Webhook) Successfully processed event: ${event.type}`);
//     } catch(error: any) {
//         console.error(`❌ (Connect Webhook) Error processing webhook event:`, error);
//         console.error((error as Error).stack); // Log stack trace
//         return NextResponse.json({error: (error as Error).message}, {status: 400});
//     }

//     return NextResponse.json({ received: true });
// }




import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

async function handleAccountUpdated(account: Stripe.Account) {
    console.log(`🔔 (Connect Webhook) RAW Stripe Account Updated Event Data: ${JSON.stringify(account, null, 2)}`);

    const connectAccountId = account.id;
    console.log(`🔍 (Connect Webhook) Processing account.updated for Connect Account ID: ${connectAccountId}`);

    const associatedProfile = await prisma.profile.findFirst({
        where: { stripeConnectAccountId: connectAccountId }
    });

    if (associatedProfile) {
        const payoutsEnabledStatusFromStripe = account.payouts_enabled ?? false;
        console.log(`ℹ️ (Connect Webhook) For Connect Account ID ${connectAccountId}:`);
        console.log(`    Stripe payouts_enabled status: ${payoutsEnabledStatusFromStripe}`);
        console.log(`    Profile found in DB: ${associatedProfile.id} (User ID: ${associatedProfile.userId})`);

        await prisma.profile.update({
            where: { id: associatedProfile.id },
            data: {
                stripePayoutsEnabled: payoutsEnabledStatusFromStripe,
            }
        });
        console.log(`✅ (Connect Webhook) Successfully updated profile for Stripe Connect account ${connectAccountId}. New stripePayoutsEnabled state: ${payoutsEnabledStatusFromStripe}`);
    } else {
        console.warn(`⚠️ (Connect Webhook) No profile found in your database for Stripe Connect Account ID: ${connectAccountId}.`);
    }
}

export async function POST(request: NextRequest) {
    console.log("🟢 (Connect Webhook) /api/webhook/connect ENDPOINT HIT - START OF REQUEST 🟢");

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
        console.error("❌ (Connect Webhook) Stripe signature is missing.");
        return NextResponse.json({ error: "Stripe signature is missing." }, { status: 400 });
    }
    console.log(`🔑 (Connect Webhook) Stripe signature present: ${!!signature}`);

    const webhookSecret = process.env.STRIPE_WEBHOOK_CONNECT_SECRET;
    if (!webhookSecret) {
        console.error("❌ (Connect Webhook) STRIPE_WEBHOOK_CONNECT_SECRET is not set.");
        return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
    }
    console.log(`🔐 (Connect Webhook) Webhook secret configured (connect): ${!!webhookSecret}`);

    let event: Stripe.Event;

    try {
        const body = await request.arrayBuffer();
        const bufferBody = Buffer.from(body);
        console.log(`🔍 (Connect Webhook) Body length: ${bufferBody.length} bytes`);

        event = stripe.webhooks.constructEvent(
            bufferBody,
            signature,
            webhookSecret
        );
        console.log(`✅ (Connect Webhook) Verified! Event type: ${event.type}`);
    } catch (error: any) {
        console.error(`❌ (Connect Webhook) Verification failed:`, error.message);
        return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    try {
        console.log(`🔄 (Connect Webhook) Processing event: ${event.type}`);
        
        switch (event.type) {
            case "account.updated": {
                const account = event.data.object as Stripe.Account;
                await handleAccountUpdated(account);
                break;
            }
            default:
                console.log(`⏩ (Connect Webhook) Unhandled event type: ${event.type}`);
        }
        
        console.log(`✅ (Connect Webhook) Successfully processed event: ${event.type}`);
    } catch(error: any) {
        console.error(`❌ (Connect Webhook) Error processing webhook event:`, error);
        console.error((error as Error).stack); // Log stack trace
        return NextResponse.json({error: (error as Error).message}, {status: 400});
    }

    return NextResponse.json({ received: true });
}