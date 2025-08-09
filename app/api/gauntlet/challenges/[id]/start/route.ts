import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GauntletChallengeModel } from "@/models/Gauntlet";
import { currentUser } from "@clerk/nextjs/server";

const getIdFromRequest = (request: NextRequest) => {
  const pathname = new URL(request.url).pathname;
  // Pathname will be /api/gauntlet/challenges/[id]/start, so we need to go up two levels
  const parts = pathname.split('/');
  return parts[parts.length - 2];
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const id = getIdFromRequest(request);
    if (!id) {
      return NextResponse.json({ error: "Challenge ID not found in URL" }, { status: 400 });
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const challenge = await GauntletChallengeModel.findById(id);

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Ensure the user trying to start the game is one of the players
    const isPlayer = challenge.challenger.userId === clerkUser.id || challenge.opponent?.userId === clerkUser.id;
    if (!isPlayer) {
      return NextResponse.json({ error: "You are not a player in this challenge." }, { status: 403 });
    }

    // Atomically find and update the challenge IF its status is 'active'
    const updatedChallenge = await GauntletChallengeModel.findOneAndUpdate(
      { _id: id, status: 'active' },
      {
        $set: {
          status: 'in_progress',
          startedByUserId: clerkUser.id,
          startedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedChallenge) {
      // If the document is not found or status was not 'active', it means someone else already started it.
      // We can check the current status to give a more precise message.
      const currentState = await GauntletChallengeModel.findById(id).select('status').lean();
      if (currentState && currentState.status === 'in_progress') {
        return NextResponse.json({ success: true, message: "Game already in progress." });
      }
      return NextResponse.json({ error: "Game could not be started. It might not be active anymore." }, { status: 409 });
    }

    return NextResponse.json({ success: true, message: "Game started." });
  } catch (error: any) {
    console.error("Error starting gauntlet game:", error);
    return NextResponse.json({ error: "Failed to start game", details: error.message }, { status: 500 });
  }
}