import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import { incrementUserContribution, ContributionType } from "@/lib/contributionUpdater";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { authorUsername, ...gameData } = body;

        if (!gameData.gameId || !authorUsername) {
            return NextResponse.json({ error: "Missing required fields: gameId and authorUsername are required." }, { status: 400 });
        }

        await connectToDatabase();

        // Check if gameId already exists
        const existingGame = await GameModel.findOne({ gameId: gameData.gameId });
        if (existingGame) {
            return NextResponse.json({ error: `Game with gameId '${gameData.gameId}' already exists.` }, { status: 409 });
        }

        // Create the new game
        const newGame = await GameModel.create({
            ...gameData,
            authorUsername // Ensure authorUsername is saved with the game
        });

        // Find the author's profile to get their clerkId
        const authorProfile = await prisma.profile.findUnique({
            where: { username: authorUsername }
        });

        if (authorProfile) {
            // Award contribution points
            await incrementUserContribution(
                authorProfile.userId,
                authorUsername,
                ContributionType.GAME_PUBLICATION,
                1
            );
            console.log(`Awarded GAME_PUBLICATION points to ${authorUsername}`);
        } else {
            console.warn(`Could not find profile for username: ${authorUsername}. Contribution points not awarded.`);
        }

        return NextResponse.json({ success: true, game: newGame }, { status: 201 });

    } catch (error: any) {
        console.error("Error creating game from submission:", error);
        return NextResponse.json({
            error: "Failed to create game",
            details: error.message
        }, { status: 500 });
    }
}