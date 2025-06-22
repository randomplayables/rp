import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSubmissionModel from "@/models/GameSubmission";

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id || !clerkUser.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the primary email address
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "User email not found." }, { status: 400 });
    }

    const body = await request.json();
    // MODIFIED: Removed 'link' from destructuring
    const { name, description, year, image, version, codeUrl, irlInstructions } = body;

    // MODIFIED: Updated validation
    if (!name || !year || !image || !version || !codeUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectToDatabase();

    const newGameSubmission = new GameSubmissionModel({
      name,
      description,
      year,
      image,
      version,
      // REMOVED: 'link' field
      codeUrl,
      irlInstructions: irlInstructions || [],
      authorUsername: clerkUser.username,
      authorEmail: email, // ADDED: Save the user's email
      submittedByUserId: clerkUser.id,
      status: 'pending',
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