import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SketchGameModel, SketchGameSessionModel } from "@/models/SketchData";
import { v4 as uuidv4 } from "uuid";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { sketchGameId, passedUserId, passedUsername } = await request.json();

    if (!sketchGameId) {
      return NextResponse.json({ error: "Missing sketchGameId." }, { status: 400 });
    }

    // Verify the sketch game exists
    const sketchGame = await SketchGameModel.findOne({ id: sketchGameId });
    if (!sketchGame) {
      return NextResponse.json({ error: "Sketch game not found." }, { status: 404 });
    }

    let clerkUser = await currentUser();
    let userId = clerkUser?.id || passedUserId;
    let username = clerkUser?.username || passedUsername;

    if (userId && !username) {
        try {
            const profile = await prisma.profile.findUnique({ where: { userId: userId } });
            if(profile?.username) username = profile.username;
        } catch (err) {
            console.error("Error fetching username from Prisma for sketch session:", err);
        }
    }
    
    const isGuest = !userId;
    const sessionId = uuidv4();

    await SketchGameSessionModel.create({
      sessionId,
      sketchGameId,
      userId,
      username,
      isGuest,
    });

    return NextResponse.json({ sessionId, userId, username, isGuest });
  } catch (error: any) {
    console.error("Error creating sketch game session:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}