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

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import { UserContributionModel, PointTransferModel, ContributionMetrics } from "@/models/RandomPayables";
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
  if (!id) return NextResponse.json({ error: "Challenge ID not found" }, { status: 400, headers });

  const user = await currentUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  await connectToDatabase();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const challenge = await GauntletChallengeModel.findById(id).session(session);
    if (!challenge) throw new Error("Challenge not found");

    if (challenge.status !== "in_progress") {
      await session.abortTransaction();
      return NextResponse.json(
        { message: "Challenge is not in progress. It may have already been resolved." },
        { status: 200, headers }
      );
    }

    // Must know who started; only the NON-STARTER may report abandonment
    const starterId = challenge.startedByUserId;
    if (!starterId) throw new Error("Starter not recorded for this challenge.");

    if (user.id === starterId) {
      return NextResponse.json(
        { error: "Only the non-starter can report abandonment." },
        { status: 403, headers }
      );
    }

    // Identify reporter/winner (actor) and starter/loser
    const reporterIsChallenger = challenge.challenger?.userId === user.id;
    const reporter = reporterIsChallenger ? challenge.challenger : challenge.opponent!;
    const starterIsChallenger = challenge.challenger?.userId === starterId;
    const starter = starterIsChallenger ? challenge.challenger : challenge.opponent!;

    if (!reporter || !starter) throw new Error("Could not determine reporter/starter.");
    const winner = reporter;       // ✅ reporter wins
    const loser  = starter;        // ✅ starter loses

    const winnerStake = Number(winner.wager || 0);
    const loserStake  = Number(loser.wager  || 0);
    const totalWager  = winnerStake + loserStake;

    // Wager bucket
    const rawKey = (challenge.wagerSubCategory as keyof ContributionMetrics) || "totalPoints";
    const isOther = (OTHER_CATEGORY_KEYS as readonly string[]).includes(rawKey as any);

    // Credit winner: refund + opponent stake in the wagered bucket
    const updatedWinner = await UserContributionModel.findOneAndUpdate(
      { userId: winner.userId },
      { $inc: { [`metrics.${rawKey}`]: totalWager } },
      { session, upsert: true, new: true }
    );

    // Keep weighted totals in sync for BOTH players if "Other"
    if (isOther) {
      const [winnerDoc, loserDoc] = await Promise.all([
        updatedWinner
          ? Promise.resolve(updatedWinner)
          : UserContributionModel.findOne({ userId: winner.userId }).session(session),
        UserContributionModel.findOne({ userId: loser.userId }).session(session),
      ]);

      const weights = await loadOtherWeights();

      if (winnerDoc) {
        await UserContributionModel.updateOne(
          { userId: winner.userId },
          { $set: { "metrics.totalPoints": getWeightedPoints(winnerDoc.metrics as ContributionMetrics, weights) } },
          { session }
        );
      }
      if (loserDoc) {
        await UserContributionModel.updateOne(
          { userId: loser.userId },
          { $set: { "metrics.totalPoints": getWeightedPoints(loserDoc.metrics as ContributionMetrics, weights) } },
          { session }
        );
      }
    }

    // Ledger: record ONLY the loser's (starter's) stake in the wagered sub-bucket
    await PointTransferModel.create(
      [
        {
          senderUserId: loser.userId,
          senderUsername: loser.username,
          recipientUserId: winner.userId,
          recipientUsername: winner.username,
          amount: loserStake,
          memo: `Gauntlet abandonment for challenge ${challenge._id}`,
          pointType: String(rawKey),
          otherCategorySubType: String(rawKey),
          context: { type: "GAUNTLET_ABANDON", challengeId: String(challenge._id) },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    // Close out challenge
    challenge.status = "completed";
    challenge.winner = winner.team;         // A or B, matching your model
    challenge.completedAt = new Date();
    await challenge.save({ session });

    await session.commitTransaction();
    return NextResponse.json(
      { success: true, message: "Abandonment recorded. Reporter awarded points." },
      { headers }
    );
  } catch (err: any) {
    await session.abortTransaction();
    return NextResponse.json(
      { error: "Failed to abandon challenge", details: err.message || String(err) },
      { status: 500, headers }
    );
  } finally {
    session.endSession();
  }
}