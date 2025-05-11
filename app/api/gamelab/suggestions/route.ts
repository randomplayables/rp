import { NextResponse } from "next/server";

export async function GET() {
  const suggestions = [
    "Create a number guessing game that uses Bayesian probability",
    "I want to build a grid-based puzzle game similar to Gotham Loops",
    "Help me design a memory matching game with varying difficulty levels",
    "Create a game that teaches statistics through coin flipping experiments",
    "I'd like to make a game about optimizing resource allocation",
    "Design a game that visualizes the Monty Hall problem",
    "Create a game about finding patterns in seemingly random data",
    "Help me build a simple ecosystem simulation game",
    "I want to make a citizen science game about classifying objects"
  ];
  
  return NextResponse.json({ suggestions });
}