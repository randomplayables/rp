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






import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose, { ClientSession } from "mongoose";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import {
  UserContributionModel,
  PointTransferModel,
  ContributionMetrics,
} from "@/models/RandomPayables";
import { currentUser } from "@clerk/nextjs/server";
import { isAllowedOrigin } from "@/lib/corsConfig";
import { loadOtherWeights, getWeightedPoints } from "@/lib/payablesEngine";

const OTHER_CATEGORY_KEYS = [
  "gamePublicationPoints",
  "codeContributions",
  "contentCreation",
  "communityEngagement",
] as const;

function corsHeaders(request: NextRequest) {
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

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200, headers: corsHeaders(request) });
}

const getId = (request: NextRequest) => new URL(request.url).pathname.split("/").slice(-2, -1)[0];

function decodeBearerForUserId(bearerOrToken: string | null): string | null {
  if (!bearerOrToken) return null;
  const token = bearerOrToken.startsWith("Bearer ") ? bearerOrToken.slice(7) : bearerOrToken;
  const pieces = token.split(".");
  if (pieces.length < 2) return null;
  try {
    const payloadJson = Buffer.from(pieces[1], "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as Record<string, any>;
    return (payload.sub as string) || (payload.userId as string) || (payload.uid as string) || null;
  } catch { return null; }
}

async function trySession(): Promise<{ session: ClientSession | null; use: boolean }> {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    return { session, use: true };
  } catch {
    return { session: null, use: false };
  }
}

// POST /api/gauntlet/challenges/[id]/resolve — escrow-aware resolve
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  const id = getId(request);
  if (!id) return NextResponse.json({ error: "Challenge ID not found" }, { status: 400, headers });

  let body: any = {};
  try { body = await request.json(); } catch {}
  const winnerTeam = body?.winner as "A" | "B" | undefined;
  if (!winnerTeam || !["A", "B"].includes(winnerTeam)) {
    return NextResponse.json({ error: "A valid winner ('A' or 'B') is required." }, { status: 400, headers });
  }

  const clerk = await currentUser();
  let actorUserId = clerk?.id || null;
  if (!actorUserId) {
    const authHeader = request.headers.get("Authorization");
    const urlToken = new URL(request.url).searchParams.get("authToken");
    actorUserId = decodeBearerForUserId(authHeader) || decodeBearerForUserId(urlToken);
  }
  if (!actorUserId && typeof body?.passedUserId === "string") actorUserId = body.passedUserId;
  if (!actorUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  await connectToDatabase();
  const { session, use } = await trySession();
  const mopts = use && session ? { session } : undefined;
  const completedAt = new Date();

  try {
    // Idempotent flip
    const challenge = await GauntletChallengeModel.findOneAndUpdate(
      { _id: id, status: "in_progress" },
      { $set: { status: "completed", winner: winnerTeam, completedAt } },
      { new: true, ...(mopts || {}) }
    ).exec();
    if (!challenge) {
      return NextResponse.json({ message: "Challenge already resolved. No changes applied." }, { status: 200, headers });
    }

    const isPlayer = challenge.challenger?.userId === actorUserId || challenge.opponent?.userId === actorUserId;
    if (!isPlayer) {
      if (use) await session!.abortTransaction();
      return NextResponse.json({ error: "You are not a player in this challenge." }, { status: 403, headers });
    }

    const winnerInfo = challenge.challenger?.team === winnerTeam ? challenge.challenger : challenge.opponent;
    const loserInfo  = challenge.challenger?.team !== winnerTeam ? challenge.challenger : challenge.opponent;
    if (!winnerInfo?.userId || !loserInfo?.userId) {
      if (use) await session!.abortTransaction();
      return NextResponse.json({ error: "Could not determine winner and loser." }, { status: 500, headers });
    }

    const winnerStake = Number(winnerInfo.wager || 0);
    const loserStake  = Number(loserInfo.wager  || 0);
    const totalWager  = winnerStake + loserStake;

    const rawKey = (challenge.wagerSubCategory as keyof ContributionMetrics) || "totalPoints";
    const isOther = (OTHER_CATEGORY_KEYS as readonly string[]).includes(rawKey as any);

    // Escrow-aware resolve: winner gets refund + opponent stake; loser unchanged here
    await UserContributionModel.updateOne(
      { userId: winnerInfo.userId },
      { $inc: { [`metrics.${rawKey}`]: totalWager } },
      mopts
    ).exec();

    // Recompute weighted totals for BOTH players when using an "Other" sub-bucket
    if (isOther) {
      const [winnerDoc, loserDoc] = await Promise.all([
        UserContributionModel.findOne({ userId: winnerInfo.userId }).session(session || null).exec(),
        UserContributionModel.findOne({ userId: loserInfo.userId  }).session(session || null).exec(),
      ]);
      const weights = await loadOtherWeights();

      if (winnerDoc) {
        await UserContributionModel.updateOne(
          { userId: winnerInfo.userId },
          { $set: { "metrics.totalPoints": getWeightedPoints(winnerDoc.metrics as ContributionMetrics, weights) } },
          mopts
        ).exec();
      }
      if (loserDoc) {
        await UserContributionModel.updateOne(
          { userId: loserInfo.userId },
          { $set: { "metrics.totalPoints": getWeightedPoints(loserDoc.metrics as ContributionMetrics, weights) } },
          mopts
        ).exec();
      }
    }

    // Ledger: single row for ONLY loserStake in the wagered sub-bucket
    await PointTransferModel.create(
      [
        {
          senderUserId: loserInfo.userId,
          senderUsername: loserInfo.username,
          recipientUserId: winnerInfo.userId,
          recipientUsername: winnerInfo.username,
          amount: loserStake,
          memo: `Gauntlet winnings for challenge ${challenge._id}`,
          pointType: String(rawKey),
          otherCategorySubType: String(rawKey),
          context: {
            kind: "GAUNTLET_WIN",
            challengeId: String(challenge._id),
            wagerSubCategory: challenge.wagerSubCategory || null,
            winnerTeam,
          },
          timestamp: completedAt,
        },
      ],
      mopts
    );

    if (use) await session!.commitTransaction();
    return NextResponse.json({ success: true, message: "Challenge resolved and points transferred." }, { status: 200, headers });
  } catch (err) {
    if (use) { try { await session!.abortTransaction(); } catch {} }
    console.error(`Error resolving gauntlet challenge ${id}:`, err);
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to resolve challenge", details }, { status: 500, headers });
  } finally {
    if (use) { try { session!.endSession(); } catch {} }
  }
}