import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Game from "@/models/Game";

export async function GET() {
  await connectToDatabase();
  const games = await Game.find({}).lean();
  return NextResponse.json(games);
}