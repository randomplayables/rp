import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import mongoose from "mongoose"; // Make sure mongoose is imported for schema definitions
import { connectToDatabase } from "@/lib/mongodb"; // Main DB connection
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
import GameModel from "@/models/Game";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";

import QuestionModel from "@/models/Question";
import AnswerModel from "@/models/Answer";
import { UserContributionModel } from "@/models/RandomPayables";
import UserInstrumentModel from "@/models/UserInstrument";
import UserSketchModel from "@/models/UserSketch";
import UserVisualizationModel from "@/models/UserVisualization";

// --- Sandbox Model Schemas (derived from app/api/gamelab/sandbox/route.tsx) ---
const SandboxGameSchemaInternal = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: { type: String, required: true },
  description: { type: String },
  year: { type: Number, default: new Date().getFullYear() },
  image: { type: String, default: "/placeholder-game.png" },
  link: { type: String, required: true },
  irlInstructions: [{ title: String, url: String, _id: false }],
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  isTestGame: { type: Boolean, default: true }
});

const SandboxGameSessionSchemaInternal = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String },
  gameId: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  isTestSession: { type: Boolean, default: true }
});

const SandboxGameDataSchemaInternal = new mongoose.Schema({
  sessionId: { type: String, required: true },
  gameId: { type: String, required: true },
  userId: { type: String },
  roundNumber: { type: Number },
  roundData: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  isTestData: { type: Boolean, default: true }
});

// --- Helper to get a connection to the Sandbox DB ---
let sandboxConnectionInstance: mongoose.Connection | null = null;

async function getSandboxConnection(): Promise<mongoose.Connection> {
  if (sandboxConnectionInstance && sandboxConnectionInstance.readyState === 1) {
    return sandboxConnectionInstance;
  }
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not defined for sandbox connection");
    throw new Error("MONGODB_URI not defined for sandbox connection");
  }
  try {
    const conn = mongoose.createConnection(MONGODB_URI);
    sandboxConnectionInstance = await conn.useDb("GameLabSandbox", { useCache: true });
    return sandboxConnectionInstance;
  } catch (error) {
    console.error("DataLab: Error connecting to GameLabSandbox database:", error);
    if (sandboxConnectionInstance) {
        await sandboxConnectionInstance.close().catch(e => console.error("DataLab: Failed to close errored sandbox connection", e));
    }
    sandboxConnectionInstance = null;
    throw error;
  }
}

// --- Helper to get Sandbox Models from the Sandbox Connection ---
async function getDynamicSandboxModels() {
  const sandboxConn = await getSandboxConnection();
  return {
    SandboxGame: sandboxConn.models.Game || sandboxConn.model("Game", SandboxGameSchemaInternal),
    SandboxGameSession: sandboxConn.models.GameSession || sandboxConn.model("GameSession", SandboxGameSessionSchemaInternal),
    SandboxGameData: sandboxConn.models.GameData || sandboxConn.model("GameData", SandboxGameDataSchemaInternal),
  };
}


function createModelRequest(model: string, messages: any[], prompt: string) {
  const baseRequest = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: model.includes('o4-mini') ? 4000 : 2000,
  };
  // Removed console logs for cleaner output
  return baseRequest;
}

const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const DATA_TYPES = {
  GAME: "Game",
  SURVEY: "Survey",
  STACK: "Stack",
  CONTRIBUTIONS: "Contributions",
  CONTENT: "Content",
  SANDBOX: "Sandbox"
};

async function fetchRelevantData(
  query: string,
  userId: string | null,
  selectedDataTypes?: string[]
) {
  await connectToDatabase(); 
  const dataContext: any = {};

  const effectiveDataTypes = (selectedDataTypes && selectedDataTypes.length > 0)
                             ? selectedDataTypes
                             : [DATA_TYPES.GAME];

  if (effectiveDataTypes.includes(DATA_TYPES.GAME)) {
    if (userId) {
      dataContext.userSessions = await GameSessionModel.find({ userId }).limit(100).lean();
    }
    dataContext.recentSessions = await GameSessionModel.find().sort({ startTime: -1 }).limit(100).lean();
    // --- Point 4 Fix: Added .limit(200) to GameModel.find() ---
    dataContext.games = await GameModel.find().limit(200).lean(); 
    dataContext.gameDataStats = await GameDataModel.aggregate([
      {
        $group: {
          _id: "$gameId",
          totalRounds: { $sum: 1 },
          averageScore: { $avg: "$roundData.finalScore" },
          playerUserIds: { $addToSet: "$userId" }
        }
      },
      {
        $project: {
            _id: 1,
            totalRounds: 1,
            averageScore: 1,
            playerCount: { $size: "$playerUserIds" }
        }
      }
    ]);
    if (query.toLowerCase().includes('time') || query.toLowerCase().includes('date') || query.toLowerCase().includes('day')) {
        dataContext.sessionsByDate = await GameSessionModel.aggregate([
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
              count: { $sum: 1 },
              uniquePlayerIds: { $addToSet: "$userId" }
            }
          },
          { $sort: { "_id": -1 } },
          { $limit: 30 },
           {
            $project: {
                _id: 1,
                count: 1,
                uniquePlayers: { $size: "$uniquePlayerIds" }
            }
          }
        ]);
    }
  }

  if (effectiveDataTypes.includes(DATA_TYPES.SURVEY)) {
    if (userId) {
      dataContext.userSurveys = await SurveyModel.find({ userId }).limit(50).lean();
    }
    const surveyIdsForResponses = dataContext.userSurveys?.map((s: any) => s._id.toString()) || [];
    if (surveyIdsForResponses.length > 0) {
      dataContext.surveyResponses = await SurveyResponseModel.find({
        surveyId: { $in: surveyIdsForResponses }
      }).limit(200).lean();
      dataContext.surveyStats = await SurveyResponseModel.aggregate([
        { $match: { surveyId: { $in: surveyIdsForResponses } } },
        {
          $group: {
            _id: "$surveyId",
            responseCount: { $sum: 1 },
            averageCompletionTime: {
              $avg: { $subtract: ["$metadata.endTime", "$metadata.startTime"] }
            }
          }
        }
      ]);
    }
  }

  if (effectiveDataTypes.includes(DATA_TYPES.STACK)) {
    if (userId) {
      dataContext.userQuestions = await QuestionModel.find({ userId }).limit(20).lean();
      dataContext.userAnswers = await AnswerModel.find({ userId }).limit(50).lean();
    }
    dataContext.recentQuestions = await QuestionModel.find().sort({ createdAt: -1 }).limit(20).lean();
    dataContext.recentAnswers = await AnswerModel.find().sort({ createdAt: -1 }).limit(50).lean();
    dataContext.questionStats = await QuestionModel.aggregate([
        { $group: { _id: "$userId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);
  }

  if (effectiveDataTypes.includes(DATA_TYPES.CONTRIBUTIONS)) {
    if (userId) {
      dataContext.userContributions = await UserContributionModel.findOne({ userId }).lean();
    }
    dataContext.topContributors = await UserContributionModel.find()
        .sort({ 'metrics.totalPoints': -1 })
        .limit(10)
        .select('username metrics.totalPoints winCount')
        .lean();
  }

  if (effectiveDataTypes.includes(DATA_TYPES.CONTENT)) {
    if (userId) {
      dataContext.userInstruments = await UserInstrumentModel.find({ userId }).limit(20).lean();
      dataContext.userSketches = await UserSketchModel.find({ userId }).limit(20).lean();
      dataContext.userVisualizations = await UserVisualizationModel.find({ userId }).limit(20).lean();
    }
    dataContext.publicInstruments = await UserInstrumentModel.find({ isPublic: true }).sort({ createdAt: -1 }).limit(10).lean();
    dataContext.publicSketches = await UserSketchModel.find({ isPublic: true }).sort({ createdAt: -1 }).limit(10).lean();
    dataContext.publicVisualizations = await UserVisualizationModel.find({ isPublic: true }).sort({ createdAt: -1 }).limit(10).lean();
  }
  
  if (effectiveDataTypes.includes(DATA_TYPES.SANDBOX)) {
    try {
      const { SandboxGame, SandboxGameSession, SandboxGameData } = await getDynamicSandboxModels();
      dataContext.sandboxGames = await SandboxGame.find({ isTestGame: true }).limit(20).lean();
      dataContext.sandboxSessions = await SandboxGameSession.find({ isTestSession: true }).sort({ startTime: -1 }).limit(50).lean();
      dataContext.sandboxGameData = await SandboxGameData.find({ isTestData: true }).sort({ timestamp: -1 }).limit(100).lean();
    } catch (sandboxError: any) {
      console.error("DataLab: Error fetching Sandbox data:", sandboxError.message);
      dataContext.sandboxFetchError = "Could not fetch Sandbox data: " + sandboxError.message;
    }
  }
  
  if (userId && (query.toLowerCase().includes('user') || query.toLowerCase().includes('player'))) {
    dataContext.userProfile = await prisma.profile.findUnique({
      where: { userId }
    });
  }

  return dataContext;
}

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, chatHistory, systemPrompt: customSystemPrompt, selectedDataTypes } = await request.json();
    
    const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id);
    
    if (!canUseApi) {
      return NextResponse.json({ 
        error: "Monthly API request limit reached. Please upgrade your plan for more requests.", 
        limitReached: true 
      }, { status: 403 });
    }
    
    const userId = clerkUser?.id || null;
    
    const actualDataTypesUsedForFetching = (selectedDataTypes && selectedDataTypes.length > 0)
                                     ? selectedDataTypes
                                     : [DATA_TYPES.GAME];
    
    // 1. Fetch data first
    const dataContext = await fetchRelevantData(message, userId, selectedDataTypes);
    
    // 2. Construct the systemPromptText AFTER dataContext is populated
    const systemPromptText = customSystemPrompt || `
    You are an AI assistant specialized in creating D3.js visualizations for a citizen science gaming platform.
    You have access to data from MongoDB and PostgreSQL based on the user's selection.
    
    IMPORTANT: The data is ALREADY PROVIDED to you in the dataContext. 
    DO NOT generate code that fetches data using d3.json() or any other external data fetching.
    All data must be used from the \`dataContext\` variable which will be made available to your D3 code.
    The user has selected the following data categories: ${actualDataTypesUsedForFetching.join(', ')}.
    
    Available data context structure (some fields might be null or empty based on selection and data availability):
    ${JSON.stringify(Object.keys(dataContext), null, 2)} 
    
    When creating visualizations:
    1. Generate pure D3.js code that can be executed in a browser.
    2. The code should expect 'd3' and 'container' (the HTML element for the chart) as parameters.
    3. It will also have access to a 'dataContext' variable containing the fetched data.
    4. Use the container parameter as the target element for the visualization.
    5. EMBED ALL DATA referenced FROM THE \`dataContext\` DIRECTLY IN THE CODE if needed, or use the \`dataContext\` variable directly.
    6. Data from \`dataContext\` should be accessed like: \`dataContext.recentSessions\`, \`dataContext.userSurveys\`, etc.
    7. Include proper scales, axes, and labels.
    8. Use responsive design principles where possible.
    9. Apply emerald colors (#10B981, #059669, #047857) to match the theme.
    10. Handle edge cases like empty data gracefully (e.g., if \`dataContext.userSurveys\` is empty or \`dataContext.sandboxFetchError\` is present).
    
    Example of how to structure your D3 code:
    \`\`\`javascript
    // Access data from the provided dataContext
    const sessions = dataContext.recentSessions || []; 
    
    if (dataContext.sandboxFetchError) {
      d3.select(container).append("p").style("color", "orange").text("Note: Sandbox data could not be fetched: " + dataContext.sandboxFetchError);
    }

    if (!sessions || sessions.length === 0) {
      d3.select(container)
        .append("p")
        .style("text-align", "center")
        .text("No session data available for visualization based on your selection.");
      return;
    }
    
    const margin = {top: 20, right: 30, bottom: 40, left: 90};
    const containerWidth = container && container.clientWidth > 0 ? container.clientWidth : 600; // Default width
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom; // Default height

    const svg = d3.select(container).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // ... rest of your D3 code using the 'sessions' variable ...
    \`\`\`
    When a user asks for a plot or visualization:
    1. Analyze what data is relevant from the \`dataContext\` based on their query AND their selected data types.
    2. Extract and transform data from \`dataContext\` as needed.
    3. Create an appropriate D3.js visualization.
    4. Ensure the D3 code correctly accesses data via the \`dataContext\` variable.
    Return ONLY the JavaScript code for the D3.js visualization. Do not include explanations unless specifically asked.
    `;
    
    const messagesToAI = [
      { role: "system", content: systemPromptText },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: `Given the available dataContext (which includes data categories: ${actualDataTypesUsedForFetching.join(', ')}), ${message}` }
    ];

    const response = await openAI.chat.completions.create(
      createModelRequest(model, messagesToAI as any, systemPromptText)
    );

    await incrementApiUsage(clerkUser.id);

    const aiResponse = response.choices[0].message.content!;
    let code = "";
    let message_text = aiResponse;

    const codeMatch = aiResponse.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      code = codeMatch[1].trim();
      message_text = aiResponse.replace(/```(?:javascript|js)?\n[\s\S]*?```/, "").trim();
    } else {
      if (aiResponse.includes("d3.select") && aiResponse.includes("svg")) {
        code = aiResponse;
        message_text = "Generated D3.js visualization code:";
      } else {
        message_text = aiResponse;
        code = "";
      }
    }
    
    // Removed console logs for brevity in this response block
    // console.log("DataLab API: Extracted D3 code snippet:", code.substring(0, 200) + "...");
    // console.log("DataLab API: Assistant message text:", message_text);
    // console.log("DataLab API: Returning dataContext keys:", Object.keys(dataContext));

    return NextResponse.json({
      message: message_text,
      code: code,
      dataContext: dataContext,
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