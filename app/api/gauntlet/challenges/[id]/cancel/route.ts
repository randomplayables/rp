// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import mongoose from "mongoose";
// import { GauntletChallengeModel } from "@/models/Gauntlet";
// import { UserContributionModel } from "@/models/RandomPayables";
// import { currentUser } from "@clerk/nextjs/server";
// import { isAllowedOrigin } from "@/lib/corsConfig";

// const getIdFromRequest = (request: NextRequest) => {
//   const pathname = new URL(request.url).pathname;
//   const parts = pathname.split('/');
//   return parts[parts.length - 2];
// };

// // Dynamic CORS headers using shared helper
// function getDynamicCorsHeaders(request: NextRequest) {
//   const origin = request.headers.get('origin');
//   const base = {
//     'Access-Control-Allow-Methods': 'POST, OPTIONS',
//     'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//   } as Record<string, string>;

//   if (origin && isAllowedOrigin(origin)) {
//     return {
//       ...base,
//       'Access-Control-Allow-Origin': origin,
//       'Access-Control-Allow-Credentials': 'true',
//     };
//   }
//   return { ...base, 'Access-Control-Allow-Origin': '*' };
// }

// // Preflight for credentialed requests from game subdomains
// export async function OPTIONS(request: NextRequest) {
//   return NextResponse.json({}, { status: 200, headers: getDynamicCorsHeaders(request) });
// }

// export async function POST(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   const id = getIdFromRequest(request);
//   const corsHeaders = getDynamicCorsHeaders(request);
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     if (!id) {
//       throw new Error("Challenge ID not found in URL");
//     }

//     const clerkUser = await currentUser();
//     if (!clerkUser) {
//       throw new Error("Unauthorized");
//     }

//     await connectToDatabase();

//     const challenge = await GauntletChallengeModel.findById(id).session(session);

//     if (!challenge) {
//       throw new Error("Challenge not found");
//     }

//     if (challenge.status !== 'pending') {
//       await session.abortTransaction();
//       return NextResponse.json({ message: "Only pending challenges can be cancelled." }, { status: 409, headers: corsHeaders });
//     }

//     if (challenge.challenger.userId !== clerkUser.id) {
//       throw new Error("Only the challenger can cancel this challenge.");
//     }

//     // Refund the challenger's wager
//     await UserContributionModel.updateOne(
//       { userId: challenge.challenger.userId },
//       { $inc: { 'metrics.totalPoints': challenge.challenger.wager } },
//       { session }
//     );

//     // Update the challenge status to 'cancelled'
//     challenge.status = 'cancelled';
//     await challenge.save({ session });

//     await session.commitTransaction();

//     return NextResponse.json({ success: true, message: "Challenge cancelled and points refunded." }, { headers: corsHeaders });

//   } catch (error: any) {
//     await session.abortTransaction();
//     console.error(`Error cancelling gauntlet challenge ${id}:`, error);
//     return NextResponse.json({ error: "Failed to cancel challenge", details: error.message }, { status: 500, headers: corsHeaders });
//   } finally {
//     session.endSession();
//   }
// }








import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import { UserContributionModel } from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";
import { isAllowedOrigin } from "@/lib/corsConfig";
import { loadOtherWeights, getWeightedPoints } from "@/lib/payablesEngine";

const OTHER_CATEGORY_KEYS = [
  "gamePublicationPoints",
  "codeContributions",
  "contentCreation",
  "communityEngagement",
] as const;

function cors(request: NextRequest) {
  const origin = request.headers.get("origin");
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (origin && isAllowedOrigin(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" };
  }
  return { ...base, "Access-Control-Allow-Origin": "*" };
}

const getId = (request: NextRequest) =>
  new URL(request.url).pathname.split("/").slice(-2, -1)[0];

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200, headers: cors(request) });
}

export async function POST(request: NextRequest) {
  const headers = cors(request);
  const id = getId(request);
  if (!id) {
    return NextResponse.json({ error: "Challenge ID not found" }, { status: 400, headers });
  }

  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const challenge = await GauntletChallengeModel.findById(id).session(session);
    if (!challenge) throw new Error("Challenge not found");

    if (challenge.status !== "pending") {
      await session.abortTransaction();
      return NextResponse.json(
        { message: "Only pending challenges can be cancelled." },
        { status: 409, headers }
      );
    }

    // Only the challenger may cancel
    if (challenge.challenger.userId !== user.id) {
      throw new Error("Only the challenger can cancel this challenge.");
    }

    // Refund challenger escrow to the *same* bucket used to stake
    const rawKey = (challenge.wagerSubCategory as string) || "totalPoints";
    const isOther = (OTHER_CATEGORY_KEYS as readonly string[]).includes(rawKey as any);

    const refunded = await UserContributionModel.findOneAndUpdate(
      { userId: challenge.challenger.userId },
      { $inc: { [`metrics.${rawKey}`]: challenge.challenger.wager } },
      { session, new: true }
    );

    // If this was an “Other” sub-bucket, recompute weighted totalPoints
    if (isOther && refunded) {
      const weights = await loadOtherWeights();
      const recomputed = getWeightedPoints(refunded.metrics as any, weights);
      await UserContributionModel.updateOne(
        { userId: challenge.challenger.userId },
        { $set: { "metrics.totalPoints": recomputed } },
        { session }
      );
    }

    // Mark cancelled
    challenge.status = "cancelled";
    await challenge.save({ session });

    await session.commitTransaction();
    return NextResponse.json(
      { success: true, message: "Challenge cancelled and points refunded." },
      { headers }
    );
  } catch (err: any) {
    await session.abortTransaction();
    return NextResponse.json(
      { error: "Failed to cancel challenge", details: err.message || String(err) },
      { status: 500, headers }
    );
  } finally {
    session.endSession();
  }
}