// app/api/datalab/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
import GameModel from "@/models/Game";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// Helper function to get data based on user query
async function fetchRelevantData(query: string, userId: string | null) {
  await connectToDatabase();
  
  const dataContext: any = {};
  
  // Fetch data based on keywords in the query
  if (query.toLowerCase().includes('game') || query.toLowerCase().includes('session')) {
    // Get game sessions
    if (userId) {
      dataContext.userSessions = await GameSessionModel.find({ userId }).limit(100).lean();
    }
    dataContext.recentSessions = await GameSessionModel.find().sort({ startTime: -1 }).limit(100).lean();
    
    // Get game data
    dataContext.games = await GameModel.find().lean();
    
    // Get aggregated game data
    dataContext.gameDataStats = await GameDataModel.aggregate([
      {
        $group: {
          _id: "$gameId",
          totalRounds: { $sum: 1 },
          averageScore: { $avg: "$roundData.finalScore" },
          playerCount: { $addToSet: "$userId" }
        }
      }
    ]);
  }
  
  if (query.toLowerCase().includes('user') || query.toLowerCase().includes('player')) {
    // Get user profile data
    if (userId) {
      dataContext.userProfile = await prisma.profile.findUnique({
        where: { userId }
      });
    }
    
    // Get user statistics
    dataContext.userStats = await GameDataModel.aggregate([
      {
        $match: userId ? { userId } : {}
      },
      {
        $group: {
          _id: "$userId",
          totalGamesPlayed: { $sum: 1 },
          averageScore: { $avg: "$roundData.finalScore" },
          gamesPlayed: { $addToSet: "$gameId" }
        }
      },
      { $limit: 20 }
    ]);
  }
  
  return dataContext;
}

export async function POST(request: NextRequest) {
  try {
    const { message, chatHistory } = await request.json();
    
    // Get current user if available
    const clerkUser = await currentUser();
    const userId = clerkUser?.id || null;
    
    // Fetch relevant data based on the query
    const dataContext = await fetchRelevantData(message, userId);
    
    const systemPrompt = `
    You are an AI assistant specialized in creating D3.js visualizations for a citizen science gaming platform.
    You have access to data from MongoDB (game sessions, game data) and PostgreSQL (user profiles).
    
    Available data context:
    ${JSON.stringify(dataContext, null, 2)}
    
    When creating visualizations:
    1. Generate pure D3.js code that can be executed in a browser
    2. The code should expect 'd3' and 'container' as parameters
    3. Use the container parameter as the target element for the visualization
    4. Include proper scales, axes, and labels
    5. Use responsive design principles
    6. Apply a consistent color scheme (prefer emerald colors to match the theme)
    7. The code should be self-contained and not rely on external data files
    
    Format your response as follows:
    - First, provide a brief explanation of what you're creating
    - Then, provide the D3.js code
    
    Example code structure:
    \`\`\`javascript
    // Set dimensions
    const margin = {top: 20, right: 20, bottom: 40, left: 40};
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    // Your visualization code here...
    \`\`\`
    
    Only return the executable JavaScript code, without markdown code blocks.
    `;
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: message }
    ];
    
    const response = await openAI.chat.completions.create({
      model: "meta-llama/llama-3.2-3b-instruct:free",
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    const aiResponse = response.choices[0].message.content!;
    
    // Extract code from the response
    let code = "";
    let message_text = aiResponse;
    
    // Try to extract code between backticks
    const codeMatch = aiResponse.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    if (codeMatch) {
      code = codeMatch[1].trim();
      message_text = aiResponse.replace(/```(?:javascript|js)?\n[\s\S]*?```/, "").trim();
    } else {
      // If no markdown code block, assume everything after the explanation is code
      const parts = aiResponse.split('\n\n');
      if (parts.length > 1) {
        message_text = parts[0];
        code = parts.slice(1).join('\n\n');
      }
    }
    
    return NextResponse.json({
      message: message_text,
      code: code
    });
    
  } catch (error: any) {
    console.error("Error in DataLab chat:", error);
    return NextResponse.json(
      { error: "Failed to generate visualization", details: error.message },
      { status: 500 }
    );
  }
}