import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Game from "@/models/Game";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const authorUsername = searchParams.get("authorUsername");
  
  await connectToDatabase();
  
  // If authorUsername is provided, filter by it
  const query = authorUsername ? { authorUsername } : {};
  const games = await Game.find(query, { _id: 0, __v: 0 }).lean();
  
  return NextResponse.json(games);
}