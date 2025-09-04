import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GauntletChallengeModel, IGauntletParticipant } from "@/models/Gauntlet";
import { UserContributionModel, ContributionMetrics } from "@/models/RandomPayables";
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

const getId = (request: NextRequest) =>
  new URL(request.url).pathname.split("/").slice(-2, -1)[0];

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200, headers: corsHeaders(request) });
}

/**
 * POST /api/gauntlet/challenges/[id]/start
 * - If opponent missing & status=pending: join (escrow opponent stake) + weighted recompute
 * - If opponent present & status=active: flip to in_progress (sets startedByUserId, startedAt)
 * - Else: no-op/idempotent
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  try {
    const id = getId(request);
    if (!id) {
      return NextResponse.json({ error: "Challenge ID not found" }, { status: 400, headers });
    }

    const user = await currentUser();
    if (!user?.id || !user.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    await connectToDatabase();
    const challenge = await GauntletChallengeModel.findById(id).exec();
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404, headers });
    }

    if (challenge.status === "in_progress" || challenge.status === "completed") {
      return NextResponse.json({ message: "Challenge already started or completed." }, { status: 200, headers });
    }

    const rawKey = (challenge.wagerSubCategory as keyof ContributionMetrics) || "totalPoints";
    const isOther = (OTHER_CATEGORY_KEYS as readonly string[]).includes(rawKey as any);

    // CASE 1: join + escrow
    if (!challenge.opponent && challenge.status === "pending") {
      if (challenge.challenger?.userId === user.id) {
        return NextResponse.json({ error: "You cannot join your own pending challenge." }, { status: 400, headers });
      }

      const opponentWager = Number(challenge.opponentWager || 0);

      // Balance check
      const current = await UserContributionModel.findOne({ userId: user.id }).exec();
      const bal = current?.metrics?.[rawKey] ?? 0;
      if (bal < opponentWager) {
        return NextResponse.json(
          { error: "Insufficient points in that category for the wager." },
          { status: 400, headers }
        );
      }

      // ESCROW: deduct from sub-bucket
      if (opponentWager !== 0) {
        await UserContributionModel.updateOne(
          { userId: user.id },
          { $inc: { [`metrics.${rawKey}`]: -opponentWager } },
          { upsert: true }
        ).exec();

        // Recompute weighted totalPoints for "Other" buckets
        if (isOther) {
          const doc = await UserContributionModel.findOne({ userId: user.id }).exec();
          if (doc) {
            const weights = await loadOtherWeights();
            const total = getWeightedPoints(doc.metrics as ContributionMetrics, weights);
            await UserContributionModel.updateOne(
              { userId: user.id },
              { $set: { "metrics.totalPoints": total } }
            ).exec();
          }
        }
      }

      // Create opponent participant (no read from absent opponent)
      const opponent: IGauntletParticipant = {
        userId: user.id,
        username: user.username!,
        team: challenge.challenger?.team === "A" ? "B" : "A",
        wager: opponentWager,
        wagerSubCategory: challenge.wagerSubCategory,
        setupConfig: {},
        hasSetup: true,
      } as IGauntletParticipant;

      challenge.opponent = opponent;
      challenge.status = "active";
      await challenge.save();

      return NextResponse.json({ success: true, challenge }, { status: 200, headers });
    }

    // CASE 2: flip active -> in_progress (RESTORED: atomic + startedByUserId/startedAt)
    if (challenge.opponent && challenge.status === "active") {
      // Verify caller is a player
      if (
        challenge.challenger?.userId !== user.id &&
        challenge.opponent?.userId !== user.id
      ) {
        return NextResponse.json({ error: "You are not a player in this challenge." }, { status: 403, headers });
      }

      const updated = await GauntletChallengeModel.findOneAndUpdate(
        { _id: id, status: "active" },
        {
          $set: {
            status: "in_progress",
            startedByUserId: user.id,
            startedAt: new Date(),
          },
        },
        { new: true }
      ).exec();

      if (!updated) {
        const currentState = await GauntletChallengeModel.findById(id).select("status").lean();
        if (currentState?.status === "in_progress") {
          return NextResponse.json({ success: true, message: "Game already in progress." }, { status: 200, headers });
        }
        return NextResponse.json(
          { error: "Game could not be started. It might not be active anymore." },
          { status: 409, headers }
        );
      }

      return NextResponse.json({ success: true, challenge: updated }, { status: 200, headers });
    }

    // CASE 3: opponent exists but status still pending -> promote to active
    if (challenge.opponent && challenge.status === "pending") {
      challenge.status = "active";
      await challenge.save();
      return NextResponse.json({ success: true, challenge }, { status: 200, headers });
    }

    return NextResponse.json({ message: "No changes applied." }, { status: 200, headers });
  } catch (err) {
    console.error("Error starting gauntlet challenge:", err);
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to start challenge", details }, { status: 500, headers });
  }
}