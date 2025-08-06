// import { getPriceIDFromType } from "@/lib/plans";
// import { NextRequest, NextResponse } from "next/server";
// import { stripe } from "@/lib/stripe";

// export async function POST(request: NextRequest) {
//     try {
//         const {planType, userId, email} = await request.json()

//         console.log(`🔍 planType: ${planType}`);
//         console.log(`🔍 userId: ${userId}`);
//         console.log(`🔍 email: ${email}`);

//         if (!planType || !userId || !email) {
//             return NextResponse.json(
//                 {
//                     error: "Plan type, user id, and email are required"
//                 },
//                 { status: 400}
//             )
//         }

//         // Update to use new plan types
//         const allowedPlanTypes = ["premium", "premium_plus"]

//         if (!allowedPlanTypes.includes(planType)){
//             return NextResponse.json(
//                 {
//                     error: "Invalid plan type"
//                 },
//                 { status: 400}
//             )
//         }

//         const priceID = getPriceIDFromType(planType)

//         if (!priceID) {
//             return NextResponse.json(
//                 {
//                     error: "Invalid price id"
//                 },
//                 { status: 400}
//             )
//         }

//         // Make sure NEXT_PUBLIC_BASE_URL is set properly
//         const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
//         console.log(`🔍 Using base URL: ${baseUrl}`);

//         // Create checkout session with clear metadata
//         const session = await stripe.checkout.sessions.create({
//             payment_method_types: ["card"],
//             line_items: [
//                 {
//                     price: priceID,
//                     quantity: 1,
//                 }
//             ],
//             customer_email: email,
//             mode: "subscription",
//             metadata: {
//                 clerkUserId: userId, 
//                 planType: planType,
//                 source: "randomplayables" // Add this to track the source
//             },
//             success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
//             cancel_url: `${baseUrl}/subscribe`,
//         })

//         console.log(`✅ Created checkout session: ${session.id}`);
//         return NextResponse.json({ url: session.url })
//     } catch (error: any) {
//         console.error(`❌ Checkout error: ${error.message}`);
//         return NextResponse.json({error: "Internal Server Error."}, {status: 500})
//     }
// }




import { getPriceIDFromType } from "@/lib/plans";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
    try {
        const {planType, userId, email} = await request.json()

        console.log(`🔍 planType: ${planType}`);
        console.log(`🔍 userId: ${userId}`);
        console.log(`🔍 email: ${email}`);

        if (!planType || !userId || !email) {
            return NextResponse.json(
                {
                    error: "Plan type, user id, and email are required"
                },
                { status: 400}
            )
        }

        // Update to use new plan types
        const allowedPlanTypes = ["premium", "premium_plus"]

        if (!allowedPlanTypes.includes(planType)){
            return NextResponse.json(
                {
                    error: "Invalid plan type"
                },
                { status: 400}
            )
        }

        const priceID = getPriceIDFromType(planType)

        if (!priceID) {
            return NextResponse.json(
                {
                    error: "Invalid price id"
                },
                { status: 400}
            )
        }

        // Make sure NEXT_PUBLIC_BASE_URL is set properly
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        console.log(`🔍 Using base URL: ${baseUrl}`);

        // Create checkout session with clear metadata
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceID,
                    quantity: 1,
                }
            ],
            // --- ADD THIS LINE ---
            automatic_tax: { enabled: true },
            // --------------------
            customer_email: email,
            mode: "subscription",
            metadata: {
                clerkUserId: userId, 
                planType: planType,
                source: "randomplayables" // Add this to track the source
            },
            success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/subscribe`,
        })

        console.log(`✅ Created checkout session: ${session.id}`);
        return NextResponse.json({ url: session.url })
    } catch (error: any) {
        console.error(`❌ Checkout error: ${error.message}`);
        return NextResponse.json({error: "Internal Server Error."}, {status: 500})
    }
}