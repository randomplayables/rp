import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SketchGameSessionModel, SketchGameDataModel } from "@/models/SketchData";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Destructure roundNumber from the body
    const { sessionId, roundData, roundNumber } = body;

    if (!sessionId || !roundData) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    await connectToDatabase();

    const session = await SketchGameSessionModel.findOne({ sessionId });
    if (!session) {
      return NextResponse.json({ error: "Invalid session." }, { status: 404 });
    }

    const sketchGameData = await SketchGameDataModel.create({
      sessionId,
      sketchGameId: session.sketchGameId,
      userId: session.userId,
      username: session.username,
      roundNumber: roundNumber, // FIX: Save the dynamic roundNumber
      roundData,
    });

    return NextResponse.json({ success: true, dataId: sketchGameData._id });
  } catch (error: any) {
    console.error("Error saving sketch game data:", error);
    return NextResponse.json({ error: "Internal Error." }, { status: 500 });
  }
}