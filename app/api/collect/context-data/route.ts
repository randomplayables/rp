import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";

// Reusable function to fetch game data for context
async function fetchCollectContextGames() {
  await connectToDatabase();
  const games = await GameModel.find({}, {
    id: 1, name: 1, description: 1, _id: 0
  }).limit(10).lean();
  return games;
}

export async function GET() {
  try {
    const games = await fetchCollectContextGames();
    return NextResponse.json({ games });
  } catch (error: any) {
    console.error("Error fetching collect context data:", error);
    return NextResponse.json(
      { error: "Failed to fetch context data", details: error.message },
      { status: 500 }
    );
  }
}