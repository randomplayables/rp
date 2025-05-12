// Create app/api/collect/suggestions/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const suggestions = [
    "Create a survey about player demographics",
    "Design a questionnaire with Gotham Loops integration",
    "Make a feedback form for my game",
    "Build a survey to study player decision making",
    "Create a survey that includes multiple games",
    "Design a research tool for measuring player engagement",
    "Build a questionnaire about puzzle-solving strategies"
  ];
  
  return NextResponse.json({ suggestions });
}