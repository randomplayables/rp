import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GauntletChallengeModel, IGauntletParticipant } from "@/models/Gauntlet";
import { currentUser } from "@clerk/nextjs/server";
import { UserContributionModel } from "@/models/RandomPayables";
import { allowedOrigins } from "@/lib/corsConfig";

function getDynamicCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  let headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin && allowedOrigins.some(allowed => origin.endsWith(allowed))) {
    return { ...headers, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' };
  }
  return { ...headers, 'Access-Control-Allow-Origin': '*' };
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200, headers: getDynamicCorsHeaders(request) });
}

const getIdFromRequest = (request: NextRequest) => {
    const pathname = new URL(request.url).pathname;
    return pathname.split('/').pop();
};

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const id = getIdFromRequest(request);
  const corsHeaders = getDynamicCorsHeaders(request);
  try {
    if (!id) {
        return NextResponse.json({ error: "Challenge ID not found in URL" }, { status: 400, headers: corsHeaders });
    }
    await connectToDatabase();
    const challenge = await GauntletChallengeModel.findById(id).lean();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json({ challenge }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`Error fetching gauntlet challenge ${id}:`, error);
    return NextResponse.json({ error: "Failed to fetch challenge" }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(
    request: NextRequest,
    context: { params: { id: string } }
) {
    const id = getIdFromRequest(request);
    const corsHeaders = getDynamicCorsHeaders(request);
    try {
        if (!id) {
            return NextResponse.json({ error: "Challenge ID not found in URL" }, { status: 400, headers: corsHeaders });
        }

        const { opponentSetupConfig } = await request.json();
        if (!opponentSetupConfig) {
            return NextResponse.json({ error: "Opponent setup configuration is required." }, { status: 400, headers: corsHeaders });
        }

        const clerkUser = await currentUser();
        if (!clerkUser || !clerkUser.id || !clerkUser.username) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        await connectToDatabase();

        const challenge = await GauntletChallengeModel.findById(id);
        if (!challenge) {
            return NextResponse.json({ error: "Challenge not found" }, { status: 404, headers: corsHeaders });
        }
        if (challenge.status !== 'pending') {
            return NextResponse.json({ error: "This challenge is no longer open." }, { status: 400, headers: corsHeaders });
        }
        if (challenge.challenger.userId === clerkUser.id) {
            return NextResponse.json({ error: "You cannot challenge yourself." }, { status: 400, headers: corsHeaders });
        }
        
        const opponentWager = challenge.opponentWager || 0;
        const userContribution = await UserContributionModel.findOne({ userId: clerkUser.id });

        if (!userContribution || userContribution.metrics.totalPoints < opponentWager) {
            return NextResponse.json({ error: "Insufficient points for this wager." }, { status: 400, headers: corsHeaders });
        }
        
        await UserContributionModel.updateOne(
            { userId: clerkUser.id },
            { $inc: { 'metrics.totalPoints': -opponentWager } }
        );

        challenge.opponent = {
            userId: clerkUser.id,
            username: clerkUser.username,
            team: challenge.challenger.team === 'A' ? 'B' : 'A',
            wager: opponentWager,
            setupConfig: opponentSetupConfig,
            hasSetup: true,
        } as IGauntletParticipant;
        challenge.status = 'active';
        
        await challenge.save();
        
        return NextResponse.json({ success: true, challenge }, { headers: corsHeaders });

    } catch (error: any) {
        console.error(`Error accepting gauntlet challenge ${id}:`, error);
        return NextResponse.json({ error: "Failed to accept challenge" }, { status: 500, headers: corsHeaders });
    }
}