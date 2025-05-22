import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
import GameModel from "@/models/Game";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server"; // Added
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection"; // Added

function createModelRequest(model: string, messages: any[], prompt: string) {
  // Basic request that works for all models
  const baseRequest = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: model.includes('o4-mini') ? 4000 : 2000, // Longer responses for more powerful models
  };

  // Add any model-specific configurations
  if (model.includes('openai/')) {
    // OpenAI models may need different formatting
    console.log(`Using OpenAI model: ${model}`);
  } else {
    // Llama models use the standard format
    console.log(`Using standard model: ${model}`);
  }

  return baseRequest;
}

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
    const clerkUser = await currentUser(); // Added
    if (!clerkUser) { // Added
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); // Added
    } // Added

    const { message, chatHistory, systemPrompt: customSystemPrompt } = await request.json();
    
    // Check subscription and get appropriate model // Added
    const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id); // Added
    
    if (!canUseApi) { // Added
      return NextResponse.json({  // Added
        error: "Monthly API request limit reached. Please upgrade your plan for more requests.",  // Added
        limitReached: true  // Added
      }, { status: 403 }); // Added
    } // Added
    
    const userId = clerkUser?.id || null;
    
    const dataContext = await fetchRelevantData(message, userId);
    
    const systemPrompt = customSystemPrompt || `
    You are an AI assistant specialized in creating D3.js visualizations...
    `;
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: message }
    ];

    const response = await openAI.chat.completions.create(
      createModelRequest(model, messages as any, systemPrompt)
    );

    await incrementApiUsage(clerkUser.id);

    const aiResponse = response.choices[0].message.content!;

    let code = "";
    let message_text = aiResponse;

    console.log("AI Response type:", typeof aiResponse);
    console.log("AI Response sample:", typeof aiResponse === 'string' ? aiResponse.substring(0, 100) : JSON.stringify(aiResponse).substring(0, 100));

    // Handle different response formats based on model
    if (typeof aiResponse === 'string') {
      // For text-based responses (like from Llama)
      const codeMatch = aiResponse.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
      if (codeMatch) {
        code = codeMatch[1].trim();
        message_text = aiResponse.replace(/```(?:javascript|js)?\n[\s\S]*?```/, "").trim();
      } else {
        // Try alternative parsing if no code block found
        const parts = aiResponse.split('\n\n');
        if (parts.length > 1) {
          message_text = parts[0];
          code = parts.slice(1).join('\n\n');
        } else {
          code = aiResponse;
          message_text = "";
        }
      }
    }

    console.log("Extracted code length:", code.length);
    console.log("Extracted message length:", message_text.length);

    return NextResponse.json({
      message: message_text,
      code: code,
      remainingRequests
    });
        
  } catch (error: any) {
    console.error("Error in DataLab chat:", error);
    return NextResponse.json(
      { error: "Failed to generate visualization", details: error.message },
      { status: 500 }
    );
  }
}