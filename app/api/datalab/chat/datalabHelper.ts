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
import { UserContributionModel, PointTransferModel } from "@/models/RandomPayables";
import UserInstrumentModel from "@/models/UserInstrument";
import UserSketchModel from "@/models/UserSketch";
import UserVisualizationModel from "@/models/UserVisualization";
import { SketchGameModel, SketchGameSessionModel, SketchGameDataModel } from "@/models/SketchData";
import PeerReviewModel from "@/models/PeerReview";
import CodeBaseModel from "@/models/CodeBase";

// --- Sandbox Model Schemas ---
const SandboxGameSchemaInternal = new mongoose.Schema({
  gameId: { type: String, unique: true, required: true },
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
  GAME_POINT_TRANSFERS: "Game.pointtransfers",
  SURVEY: "Survey",
  STACK: "Stack",
  CONTRIBUTIONS: "Contributions",
  CONTENT: "Content",
  SANDBOX: "Sandbox",
  SKETCH: "Sketch Data",
  PEER_REVIEWS: "Peer Reviews",
  CODEBASES: "Codebases",
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
    dataContext.gameSessions = await GameSessionModel.find({}).sort({ startTime: -1 }).lean();
    dataContext.games = await GameModel.find({}).lean();
    dataContext.gameData = await GameDataModel.find({}).lean();
  }

  if (effectiveDataTypes.includes(DATA_TYPES.GAME_POINT_TRANSFERS)) {
    dataContext.pointTransfers = await PointTransferModel.find().sort({ timestamp: -1 }).lean();
  }

  if (effectiveDataTypes.includes(DATA_TYPES.SURVEY)) {
    dataContext.surveys = await SurveyModel.find({}).lean();
    dataContext.surveyResponses = await SurveyResponseModel.find({}).lean();
  }

  if (effectiveDataTypes.includes(DATA_TYPES.STACK)) {
    dataContext.questions = await QuestionModel.find({}).sort({ createdAt: -1 }).lean();
    dataContext.answers = await AnswerModel.find({}).sort({ createdAt: -1 }).lean();
  }

  if (effectiveDataTypes.includes(DATA_TYPES.CONTRIBUTIONS)) {
    dataContext.userContributions = await UserContributionModel.find({}).sort({ 'metrics.totalPoints': -1 }).lean();
  }

  if (effectiveDataTypes.includes(DATA_TYPES.CONTENT)) {
    dataContext.userInstruments = await UserInstrumentModel.find({}).lean();
    dataContext.userSketches = await UserSketchModel.find({}).lean();
    dataContext.userVisualizations = await UserVisualizationModel.find({}).lean();
  }
  
  if (effectiveDataTypes.includes(DATA_TYPES.SANDBOX)) {
    try {
      const { SandboxGame, SandboxGameSession, SandboxGameData } = await getDynamicSandboxModels();
      dataContext.sandboxGames = await SandboxGame.find({ isTestGame: true }).lean();
      dataContext.sandboxSessions = await SandboxGameSession.find({ isTestSession: true }).sort({ startTime: -1 }).lean();
      dataContext.sandboxGameData = await SandboxGameData.find({ isTestData: true }).sort({ timestamp: -1 }).lean();
    } catch (sandboxError: any) {
      console.error("DataLab Helper: Error fetching Sandbox data:", sandboxError.message);
      dataContext.sandboxFetchError = "Could not fetch Sandbox data: " + sandboxError.message;
    }
  }

  if (effectiveDataTypes.includes(DATA_TYPES.SKETCH)) {
    dataContext.sketchGames = await SketchGameModel.find({}).lean();
    dataContext.sketchGameSessions = await SketchGameSessionModel.find({}).sort({ startTime: -1 }).lean();
    dataContext.sketchGameData = await SketchGameDataModel.find({}).sort({ timestamp: -1 }).lean();
  }
  
  if (effectiveDataTypes.includes(DATA_TYPES.PEER_REVIEWS)) {
    dataContext.peerReviews = await PeerReviewModel.find().sort({ mergedAt: -1 }).lean();
  }

  if (effectiveDataTypes.includes(DATA_TYPES.CODEBASES)) {
    dataContext.codebases = await CodeBaseModel.find().sort({ lastUpdated: -1 }).lean();
  }

  if (userId && (query.toLowerCase().includes('user') || query.toLowerCase().includes('player'))) {
    dataContext.userProfile = await prisma.profile.findUnique({ where: { userId } });
  }

  return dataContext;
}