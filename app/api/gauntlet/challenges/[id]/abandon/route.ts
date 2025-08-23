// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import mongoose from "mongoose";
// import { GauntletChallengeModel } from "@/models/Gauntlet";
// import { UserContributionModel } from "@/models/RandomPayables";
// import { currentUser } from "@clerk/nextjs/server";
// import { isAllowedOrigin } from "@/lib/corsConfig";

// function getDynamicCorsHeaders(request: NextRequest) {
//   const origin = request.headers.get("origin");
//   const headers = {
//     "Access-Control-Allow-Methods": "POST, OPTIONS",
//     "Access-Control-Allow-Headers": "Content-Type, Authorization",
//   } as Record<string, string>;

//   if (isAllowedOrigin(origin)) {
//     return {
//       ...headers,
//       "Access-Control-Allow-Origin": origin as string,
//       "Access-Control-Allow-Credentials": "true",
//     };
//   }
//   return { ...headers, "Access-Control-Allow-Origin": "*" };
// }

// export async function OPTIONS(request: NextRequest) {
//   return NextResponse.json({}, { status: 200, headers: getDynamicCorsHeaders(request) });
// }

// const getIdFromRequest = (request: NextRequest) => {
//   const pathname = new URL(request.url).pathname;
//   const parts = pathname.split("/");
//   return parts[parts.length - 2];
// };

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

//     if (challenge.status !== "in_progress") {
//       await session.abortTransaction();
//       return NextResponse.json(
//         { message: "Challenge is not in progress. It may have already been resolved." },
//         { status: 200, headers: corsHeaders }
//       );
//     }

//     const isChallenger = challenge.challenger.userId === clerkUser.id;
//     const isOpponent = challenge.opponent?.userId === clerkUser.id;

//     if (!isChallenger && !isOpponent) {
//       throw new Error("You are not a player in this challenge.");
//     }

//     // If the requester abandons, the *other* player wins and receives both wagers.
//     const opponent = isChallenger ? challenge.opponent : challenge.challenger;
//     if (!opponent) {
//       throw new Error("Could not determine opponent for abandonment.");
//     }

//     const totalWager = (challenge.challenger?.wager || 0) + (challenge.opponent?.wager || 0);

//     await UserContributionModel.updateOne(
//       { userId: opponent.userId },
//       { $inc: { "metrics.totalPoints": totalWager } },
//       { session, upsert: true }
//     );

//     challenge.status = "completed";
//     challenge.winner = opponent.team;
//     challenge.completedAt = new Date();
//     await challenge.save({ session });

//     await session.commitTransaction();

//     return NextResponse.json(
//       { success: true, message: "Challenge abandoned. Opponent awarded points." },
//       { headers: corsHeaders }
//     );
//   } catch (error: any) {
//     await session.abortTransaction();
//     console.error(`Error abandoning gauntlet challenge ${id}:`, error);
//     return NextResponse.json(
//       { error: "Failed to abandon challenge", details: error.message },
//       { status: 500, headers: corsHeaders }
//     );
//   } finally {
//     session.endSession();
//   }
// }






// app/api/gauntlet/challenges/[id]/abandon/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import { UserContributionModel, PointTransferModel, ContributionMetrics } from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";
import { isAllowedOrigin } from "@/lib/corsConfig";

function getDynamicCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  } as Record<string, string>;

  if (isAllowedOrigin(origin)) {
    return {
      ...headers,
      "Access-Control-Allow-Origin": origin as string,
      "Access-Control-Allow-Credentials": "true",
    };
  }
  return { ...headers, "Access-Control-Allow-Origin": "*" };
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200, headers: getDynamicCorsHeaders(request) });
}

const getIdFromRequest = (request: NextRequest) => {
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split("/");
  return parts[parts.length - 2];
};

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

    if (challenge.status !== "in_progress") {
      await session.abortTransaction();
      return NextResponse.json(
        { message: "Challenge is not in progress. It may have already been resolved." },
        { status: 200, headers: corsHeaders }
      );
    }

    const isChallenger = challenge.challenger.userId === clerkUser.id;
    const isOpponent = challenge.opponent?.userId === clerkUser.id;

    if (!isChallenger && !isOpponent) {
      throw new Error("You are not a player in this challenge.");
    }
    
    const abandonerInfo = isChallenger ? challenge.challenger : challenge.opponent;
    const winnerInfo = isChallenger ? challenge.opponent : challenge.challenger;
    if (!winnerInfo || !winnerInfo.userId || !abandonerInfo) {
      throw new Error("Could not determine participants for abandonment.");
    }

    const totalWager = (challenge.challenger?.wager || 0) + (challenge.opponent?.wager || 0);

    if (totalWager > 0) {
        const balanceField = (challenge.wagerSubCategory || 'totalPoints') as keyof ContributionMetrics;
        
        const updatePayload: any = { $inc: { [`metrics.${balanceField}`]: totalWager } };
        if (challenge.wagerSubCategory) {
            updatePayload.$inc['metrics.totalPoints'] = totalWager;
        }

        await UserContributionModel.updateOne(
          { userId: winnerInfo.userId },
          updatePayload,
          { session, upsert: true }
        );
    }

    await PointTransferModel.create(
      [
        {
          senderUserId: abandonerInfo.userId,
          senderUsername: abandonerInfo.username,
          recipientUserId: winnerInfo.userId,
          recipientUsername: winnerInfo.username,
          amount: abandonerInfo.wager,
          memo: `Gauntlet match abandoned by opponent for game: ${challenge.gameId}, challenge: ${challenge._id}`,
          pointType: challenge.wagerSubCategory ? "totalPoints" : "totalPoints",
          otherCategorySubType: challenge.wagerSubCategory,
          context: { type: "GAUNTLET_ABANDON", challengeId: challenge._id },
        },
      ],
      { session }
    );

    challenge.status = "completed";
    challenge.winner = winnerInfo.team;
    challenge.completedAt = new Date();
    await challenge.save({ session });

    await session.commitTransaction();

    return NextResponse.json(
      { success: true, message: "Challenge abandoned. Opponent awarded points." },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    await session.abortTransaction();
    console.error(`Error abandoning gauntlet challenge ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to abandon challenge", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    session.endSession();
  }
}