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

const getIdFromRequest = (request: NextRequest) => {
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split('/');
  return parts[parts.length - 2];
};

// Dynamic CORS headers using shared helper
function getDynamicCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  const base = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  } as Record<string, string>;

  if (origin && isAllowedOrigin(origin)) {
    return {
      ...base,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return { ...base, 'Access-Control-Allow-Origin': '*' };
}

// Preflight for credentialed requests from game subdomains
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200, headers: getDynamicCorsHeaders(request) });
}

const OTHER_CATEGORY_KEYS = ['gamePublicationPoints', 'codeContributions', 'contentCreation', 'communityEngagement'];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const id = getIdFromRequest(request);
  const corsHeaders = getDynamicCorsHeaders(request);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!id) {
      throw new Error("Challenge ID not found in URL");
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      throw new Error("Unauthorized");
    }

    await connectToDatabase();

    const challenge = await GauntletChallengeModel.findById(id).session(session);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    if (challenge.status !== 'pending') {
      await session.abortTransaction();
      return NextResponse.json({ message: "Only pending challenges can be cancelled." }, { status: 409, headers: corsHeaders });
    }

    if (challenge.challenger.userId !== clerkUser.id) {
      throw new Error("Only the challenger can cancel this challenge.");
    }

    // Refund the challenger's wager to the correct bucket
    const rawKey = challenge.wagerSubCategory || 'totalPoints';
    const isOtherCategoryWager = OTHER_CATEGORY_KEYS.includes(rawKey);

    const updatedChallengerContribution = await UserContributionModel.findOneAndUpdate(
        { userId: challenge.challenger.userId },
        { $inc: { [`metrics.${rawKey}`]: challenge.challenger.wager } },
        { session, new: true } // Don't upsert, challenger must exist
    );
    
    if (isOtherCategoryWager) {
        if (!updatedChallengerContribution) {
            throw new Error("Could not find contribution document for challenger to refund points.");
        }
        const weights = await loadOtherWeights();
        const newTotalPoints = getWeightedPoints(updatedChallengerContribution.metrics, weights);
        await UserContributionModel.updateOne(
            { userId: challenge.challenger.userId },
            { $set: { 'metrics.totalPoints': newTotalPoints } },
            { session }
        );
    }

    // Update the challenge status to 'cancelled'
    challenge.status = 'cancelled';
    await challenge.save({ session });

    await session.commitTransaction();

    return NextResponse.json({ success: true, message: "Challenge cancelled and points refunded." }, { headers: corsHeaders });

  } catch (error: any) {
    await session.abortTransaction();
    console.error(`Error cancelling gauntlet challenge ${id}:`, error);
    return NextResponse.json({ error: "Failed to cancel challenge", details: error.message }, { status: 500, headers: corsHeaders });
  } finally {
    session.endSession();
  }
}