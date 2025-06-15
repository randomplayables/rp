import mongoose from "mongoose";
import { connectToDatabase as connectToMainDatabase } from "@/lib/mongodb";
import GameSessionModel from "@/models/GameSession";
import GameDataModel from "@/models/GameData";
import GameModel from "@/models/Game";
import { prisma } from "@/lib/prisma";
import SurveyModel from "@/models/Survey";
import SurveyResponseModel from "@/models/SurveyResponse";
import QuestionModel from "@/models/Question";
import AnswerModel from "@/models/Answer";
import { UserContributionModel } from "@/models/RandomPayables";
import UserInstrumentModel from "@/models/UserInstrument";
import UserSketchModel from "@/models/UserSketch";
import UserVisualizationModel from "@/models/UserVisualization";
import { SketchGameModel, SketchGameSessionModel, SketchGameDataModel } from "@/models/SketchData";

// --- Sandbox Model Schemas ---
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

let sandboxConnectionInstance: mongoose.Connection | null = null;

async function getSandboxConnection(): Promise<mongoose.Connection> {
  if (sandboxConnectionInstance && sandboxConnectionInstance.readyState === 1) {
    return sandboxConnectionInstance;
  }
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI not defined for sandbox connection");
  }
  try {
    const conn = mongoose.createConnection(MONGODB_URI);
    sandboxConnectionInstance = await conn.useDb("GameLabSandbox", { useCache: true });
    return sandboxConnectionInstance;
  } catch (error) {
    console.error("DataLab Helper: Error connecting to GameLabSandbox database:", error);
    if (sandboxConnectionInstance) {
        await sandboxConnectionInstance.close().catch(e => console.error("DataLab Helper: Failed to close errored sandbox connection", e));
    }
    sandboxConnectionInstance = null;
    throw error;
  }
}

async function getDynamicSandboxModels() {
  const sandboxConn = await getSandboxConnection();
  return {
    SandboxGame: sandboxConn.models.Game || sandboxConn.model("Game", SandboxGameSchemaInternal),
    SandboxGameSession: sandboxConn.models.GameSession || sandboxConn.model("GameSession", SandboxGameSessionSchemaInternal),
    SandboxGameData: sandboxConn.models.GameData || sandboxConn.model("GameData", SandboxGameDataSchemaInternal),
  };
}

export const DATA_TYPES = {
  GAME: "Game",
  SURVEY: "Survey",
  STACK: "Stack",
  CONTRIBUTIONS: "Contributions",
  CONTENT: "Content",
  SANDBOX: "Sandbox",
  SKETCH: "Sketch Data"
};

export async function fetchRelevantData(
  query: string,
  userId: string | null,
  selectedDataTypes?: string[]
): Promise<any> {
  await connectToMainDatabase();
  const dataContext: any = {};

  const effectiveDataTypes = (selectedDataTypes && selectedDataTypes.length > 0)
                             ? selectedDataTypes
                             : [DATA_TYPES.GAME]; // Default to Game if nothing selected

  if (effectiveDataTypes.includes(DATA_TYPES.GAME)) {
    if (userId) {
      dataContext.userSessions = await GameSessionModel.find({ userId }).limit(100).lean();
    }
    dataContext.recentSessions = await GameSessionModel.find().sort({ startTime: -1 }).limit(100).lean();
    dataContext.games = await GameModel.find().limit(200).lean();
    dataContext.gameDataStats = await GameDataModel.aggregate([
      { $group: { _id: "$gameId", totalRounds: { $sum: 1 }, averageScore: { $avg: "$roundData.finalScore" }, playerUserIds: { $addToSet: "$userId" } } },
      { $project: { _id: 1, totalRounds: 1, averageScore: 1, playerCount: { $size: "$playerUserIds" } } }
    ]);
    if (query.toLowerCase().includes('time') || query.toLowerCase().includes('date') || query.toLowerCase().includes('day')) {
        dataContext.sessionsByDate = await GameSessionModel.aggregate([
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } }, count: { $sum: 1 }, uniquePlayerIds: { $addToSet: "$userId" } } },
          { $sort: { "_id": -1 } }, { $limit: 30 },
          { $project: { _id: 1, count: 1, uniquePlayers: { $size: "$uniquePlayerIds" } } }
        ]);
    }
  }

  if (effectiveDataTypes.includes(DATA_TYPES.SURVEY)) {
    if (userId) {
      dataContext.userSurveys = await SurveyModel.find({ userId }).limit(50).lean();
      const surveyIdsForResponses = dataContext.userSurveys?.map((s: any) => s._id.toString()) || [];
      if (surveyIdsForResponses.length > 0) {
        dataContext.surveyResponses = await SurveyResponseModel.find({ surveyId: { $in: surveyIdsForResponses } }).limit(200).lean();
        dataContext.surveyStats = await SurveyResponseModel.aggregate([
          { $match: { surveyId: { $in: surveyIdsForResponses } } },
          { $group: { _id: "$surveyId", responseCount: { $sum: 1 }, averageCompletionTime: { $avg: { $subtract: ["$metadata.endTime", "$metadata.startTime"] } } } }
        ]);
      }
    } else { // Provide some public survey info if no user or no user-specific surveys
        dataContext.publicSurveys = await SurveyModel.find({ /* criteria for public if any */ }).limit(20).lean();
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
        { $group: { _id: "$userId", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }
    ]);
  }

  if (effectiveDataTypes.includes(DATA_TYPES.CONTRIBUTIONS)) {
    if (userId) {
      dataContext.userContributions = await UserContributionModel.findOne({ userId }).lean();
    }
    dataContext.topContributors = await UserContributionModel.find().sort({ 'metrics.totalPoints': -1 }).limit(10).select('username metrics.totalPoints winCount').lean();
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
      console.error("DataLab Helper: Error fetching Sandbox data:", sandboxError.message);
      dataContext.sandboxFetchError = "Could not fetch Sandbox data: " + sandboxError.message;
    }
  }

  if (effectiveDataTypes.includes(DATA_TYPES.SKETCH)) {
    dataContext.sketchGames = await SketchGameModel.find({}).limit(100).lean();
    dataContext.sketchGameSessions = await SketchGameSessionModel.find({}).sort({ startTime: -1 }).limit(200).lean();
    dataContext.sketchGameData = await SketchGameDataModel.find({}).sort({ timestamp: -1 }).limit(500).lean();
  }
  
  if (userId && (query.toLowerCase().includes('user') || query.toLowerCase().includes('player'))) {
    dataContext.userProfile = await prisma.profile.findUnique({ where: { userId } });
  }

  return dataContext;
}