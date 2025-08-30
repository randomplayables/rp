// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import mongoose from "mongoose";
// import { GauntletChallengeModel } from "@/models/Gauntlet";
// import { UserContributionModel, PointTransferModel } from "@/models/RandomPayables";
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

//     const { winner } = await request.json(); // winner is 'A' or 'B'
//     if (!winner || !["A", "B"].includes(winner)) {
//       throw new Error("A valid winner ('A' or 'B') is required.");
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
//       // This prevents duplicate resolutions.
//       await session.abortTransaction();
//       return NextResponse.json(
//         { message: "Challenge is not in progress. It may have already been resolved." },
//         { status: 200, headers: corsHeaders }
//       );
//     }

//     const isPlayer =
//       challenge.challenger.userId === clerkUser.id || challenge.opponent?.userId === clerkUser.id;
//     if (!isPlayer) {
//       throw new Error("You are not a player in this challenge.");
//     }

//     const winnerInfo = challenge.challenger.team === winner ? challenge.challenger : challenge.opponent;
//     const loserInfo = challenge.challenger.team !== winner ? challenge.challenger : challenge.opponent;

//     if (!winnerInfo || !loserInfo) {
//       throw new Error("Could not determine winner and loser from challenge data.");
//     }

//     const totalWager = winnerInfo.wager + loserInfo.wager;

//     // Credit the winner
//     await UserContributionModel.updateOne(
//       { userId: winnerInfo.userId },
//       { $inc: { "metrics.totalPoints": totalWager } },
//       { session, upsert: true }
//     );

//     // Record the transfer for auditing (loser's wager)
//     await PointTransferModel.create(
//       [
//         {
//           senderUserId: loserInfo.userId,
//           senderUsername: loserInfo.username,
//           recipientUserId: winnerInfo.userId,
//           recipientUsername: winnerInfo.username,
//           amount: loserInfo.wager,
//           memo: `Gauntlet match loss for game: ${challenge.gameId}, challenge: ${challenge._id}`,
//           pointType: "totalPoints",
//           context: { type: "GAUNTLET_TRANSFER", challengeId: challenge._id },
//         },
//       ],
//       { session }
//     );

//     // Update the challenge status
//     challenge.status = "completed";
//     challenge.winner = winner;
//     challenge.completedAt = new Date();
//     await challenge.save({ session });

//     await session.commitTransaction();

//     return NextResponse.json(
//       { success: true, message: "Challenge resolved and points transferred." },
//       { headers: corsHeaders }
//     );
//   } catch (error: any) {
//     await session.abortTransaction();
//     console.error(`Error resolving gauntlet challenge ${id}:`, error);
//     return NextResponse.json(
//       { error: "Failed to resolve challenge", details: error.message },
//       { status: 500, headers: corsHeaders }
//     );
//   } finally {
//     session.endSession();
//   }
// }






// app/api/gauntlet/challenges/[id]/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import { UserContributionModel, PointTransferModel } from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";
import { isAllowedOrigin } from "@/lib/corsConfig";
import { loadOtherWeights, getWeightedPoints } from "@/lib/payablesEngine";

function getDynamicCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  } as Record<string, string>;

  if (origin && isAllowedOrigin(origin)) {
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

    const { winner } = await request.json(); // winner is 'A' or 'B'
    if (!winner || !["A", "B"].includes(winner)) {
      throw new Error("A valid winner ('A' or 'B') is required.");
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

    const isPlayer =
      challenge.challenger.userId === clerkUser.id || challenge.opponent?.userId === clerkUser.id;
    if (!isPlayer) {
      throw new Error("You are not a player in this challenge.");
    }

    const winnerInfo = challenge.challenger.team === winner ? challenge.challenger : challenge.opponent;
    const loserInfo = challenge.challenger.team !== winner ? challenge.challenger : challenge.opponent;

    if (!winnerInfo || !loserInfo || !winnerInfo.userId || !loserInfo.userId) {
      throw new Error("Could not determine winner and loser from challenge data.");
    }

    const totalWager = (winnerInfo.wager || 0) + (loserInfo.wager || 0);

    // Credit the winner
    if (totalWager > 0) {
        const rawKey = challenge.wagerSubCategory || 'totalPoints';
        const isOtherCategoryWager = OTHER_CATEGORY_KEYS.includes(rawKey);

        const updatedWinnerContribution = await UserContributionModel.findOneAndUpdate(
          { userId: winnerInfo.userId },
          { $inc: { [`metrics.${rawKey}`]: totalWager }, $setOnInsert: { username: winnerInfo.username } },
          { session, upsert: true, new: true }
        );

        if (isOtherCategoryWager) {
            if (!updatedWinnerContribution) {
                throw new Error("Failed to find or create contribution document for the winner.");
            }
            const weights = await loadOtherWeights();
            const newTotalPoints = getWeightedPoints(updatedWinnerContribution.metrics, weights);
            await UserContributionModel.updateOne(
                { userId: winnerInfo.userId },
                { $set: { 'metrics.totalPoints': newTotalPoints } },
                { session }
            );
        }
    }

    // Record the transfer for auditing (loser's wager)
    await PointTransferModel.create(
      [
        {
          senderUserId: loserInfo.userId,
          senderUsername: loserInfo.username,
          recipientUserId: winnerInfo.userId,
          recipientUsername: winnerInfo.username,
          amount: loserInfo.wager,
          memo: `Gauntlet match loss for game: ${challenge.gameId}, challenge: ${challenge._id}`,
          pointType: challenge.wagerSubCategory ? "totalPoints" : "totalPoints",
          otherCategorySubType: challenge.wagerSubCategory,
          context: { type: "GAUNTLET_TRANSFER", challengeId: challenge._id },
        },
      ],
      { session }
    );

    // Update the challenge status
    challenge.status = "completed";
    challenge.winner = winner;
    challenge.completedAt = new Date();
    await challenge.save({ session });

    await session.commitTransaction();

    return NextResponse.json(
      { success: true, message: "Challenge resolved and points transferred." },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    await session.abortTransaction();
    console.error(`Error resolving gauntlet challenge ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to resolve challenge", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    session.endSession();
  }
}