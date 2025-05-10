// Create app/api/datalab/suggestions/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const suggestions = [
    "Show me a bar chart of game sessions by date for the last 30 days",
    "Create a pie chart showing the distribution of games played",
    "Plot the average scores across different games",
    "Show me a line chart of user activity over time",
    "Create a scatter plot of game duration vs score",
    "Visualize the number of unique players per game",
    "Show me a heatmap of player activity by hour of day",
    "Create a stacked bar chart of game sessions by difficulty level"
  ];
  
  return NextResponse.json({ suggestions });
}