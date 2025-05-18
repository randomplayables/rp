import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
import GameModel from "@/models/Game";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";

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
  
  // Add more specific data fetching for time-based analysis
  if (query.toLowerCase().includes('time') || query.toLowerCase().includes('date') || query.toLowerCase().includes('day')) {
    dataContext.sessionsByDate = await GameSessionModel.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
          count: { $sum: 1 },
          uniquePlayers: { $addToSet: "$userId" }
        }
      },
      { $sort: { "_id": -1 } },
      { $limit: 30 }
    ]);
  }

    // Add survey data when relevant
    if (query.toLowerCase().includes('survey') || query.toLowerCase().includes('collect')) {
      // Get surveys created by this user
      if (userId) {
        dataContext.userSurveys = await SurveyModel.find({ userId }).limit(50).lean();
      }
      
      // Get survey responses
      const surveyIds = dataContext.userSurveys?.map((s: any) => s._id) || [];
      if (surveyIds.length > 0) {
        dataContext.surveyResponses = await SurveyResponseModel.find({
          surveyId: { $in: surveyIds }
        }).limit(200).lean();
        
        // Add aggregated survey stats
        dataContext.surveyStats = await SurveyResponseModel.aggregate([
          {
            $match: { surveyId: { $in: surveyIds } }
          },
          {
            $group: {
              _id: "$surveyId",
              responseCount: { $sum: 1 },
              averageCompletionTime: {
                $avg: { 
                  $subtract: ["$metadata.endTime", "$metadata.startTime"] 
                }
              }
            }
          }
        ]);
      }
    }
  
  return dataContext;
}

export async function POST(request: NextRequest) {
  try {
    const { message, chatHistory, systemPrompt: customSystemPrompt } = await request.json();
    
    // Get current user if available
    const clerkUser = await currentUser();
    const userId = clerkUser?.id || null; // Add this line to define userId
    
    // Fetch relevant data based on the query
    const dataContext = await fetchRelevantData(message, userId);
    
    // Use the custom system prompt if provided, otherwise use the default
    const systemPrompt = customSystemPrompt || `
    You are an AI assistant specialized in creating D3.js visualizations...
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
      } else {
        // If we can't find a clear separation, assume it's all code
        code = aiResponse;
        message_text = "";
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