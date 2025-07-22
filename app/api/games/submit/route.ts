import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSubmissionModel from "@/models/GameSubmission";
import GameModel from "@/models/Game"; // Import the Game model

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id || !clerkUser.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "User email not found." }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      description,
      year,
      image,
      version,
      codeUrl,
      irlInstructions,
      submissionType,
      targetGameId,
      previousVersion,
      usesAiModels,
      isGauntlet, // New field
      tags
    } = body;

    if (!name || !year || !image || !version || !codeUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectToDatabase();

    let isPeerReviewEnabledForUpdate = false;
    // If this is an update, check if the original game exists, which implies peer review is set up.
    if (submissionType === 'update' && targetGameId) {
        const existingGame = await GameModel.findOne({ gameId: targetGameId });
        if (existingGame) {
            isPeerReviewEnabledForUpdate = true;
        }
    }

    const newGameSubmission = new GameSubmissionModel({
      name,
      description,
      year,
      image,
      version,
      codeUrl,
      irlInstructions: irlInstructions || [],
      authorUsername: clerkUser.username,
      authorEmail: email,
      submittedByUserId: clerkUser.id,
      status: 'pending',
      submissionType,
      targetGameId,
      previousVersion,
      usesAiModels,
      isGauntlet, // New field
      tags: tags || [],
      // Set the flag based on our check for updates, otherwise it defaults to false for initial submissions.
      isPeerReviewEnabled: isPeerReviewEnabledForUpdate, 
    });

    await newGameSubmission.save();

    return NextResponse.json({ success: true, submission: newGameSubmission }, { status: 201 });

  } catch (error: any) {
    console.error("Error submitting game for review:", error);
    return NextResponse.json(
      { error: "Failed to submit game for review", details: error.message },
      { status: 500 }
    );
  }
}