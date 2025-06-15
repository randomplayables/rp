// // models/SketchData.ts
// import mongoose, { Document, Model, Schema } from "mongoose";

// // --- Interfaces for Sketch-specific data ---
// interface ISketchGame extends Document {
//   id: number;
//   name: string;
//   description?: string;
//   authorUserId: string;
//   authorUsername: string;
//   createdAt: Date;
// }

// interface ISketchGameSession extends Document {
//   sessionId: string;
//   userId?: string;
//   username?: string;
//   sketchGameId: string; // Refers to the id in sketch_games
//   startTime: Date;
//   isGuest: boolean;
// }

// interface ISketchGameData extends Document {
//   sessionId: string;
//   sketchGameId: string;
//   userId?: string;
//   username?: string;
//   roundData: any;
//   timestamp: Date;
// }

// // --- Schemas for Sketch-specific data ---
// const SketchGameSchema = new Schema({
//   id: { type: Number, required: true, unique: true },
//   name: { type: String, required: true },
//   description: { type: String },
//   authorUserId: { type: String, required: true },
//   authorUsername: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// const SketchGameSessionSchema = new Schema({
//   sessionId: { type: String, required: true, unique: true },
//   userId: { type: String },
//   username: { type: String },
//   sketchGameId: { type: String, required: true, index: true },
//   startTime: { type: Date, default: Date.now },
//   isGuest: { type: Boolean, default: false },
// });

// const SketchGameDataSchema = new Schema({
//   sessionId: { type: String, required: true, index: true },
//   sketchGameId: { type: String, required: true },
//   userId: { type: String },
//   username: { type: String },
//   roundData: { type: Schema.Types.Mixed },
//   timestamp: { type: Date, default: Date.now },
// });

// // --- Models pointing to new collections ---
// export const SketchGameModel: Model<ISketchGame> = 
//   mongoose.models.SketchGame || mongoose.model<ISketchGame>("SketchGame", SketchGameSchema, "sketch_games");

// export const SketchGameSessionModel: Model<ISketchGameSession> = 
//   mongoose.models.SketchGameSession || mongoose.model<ISketchGameSession>("SketchGameSession", SketchGameSessionSchema, "sketch_gamesessions");

// export const SketchGameDataModel: Model<ISketchGameData> = 
//   mongoose.models.SketchGameData || mongoose.model<ISketchGameData>("SketchGameData", SketchGameDataSchema, "sketch_gamedata");

// models/SketchData.ts
import mongoose, { Document, Model, Schema } from "mongoose";

// --- Interfaces for Sketch-specific data ---
interface ISketchGame extends Document {
  id: number;
  name: string;
  description?: string;
  authorUserId: string;
  authorUsername: string;
  createdAt: Date;
}

interface ISketchGameSession extends Document {
  sessionId: string;
  userId?: string;
  username?: string;
  sketchGameId: string; // Refers to the id in sketch_games
  startTime: Date;
  isGuest: boolean;
}

interface ISketchGameData extends Document {
  sessionId: string;
  sketchGameId: string;
  userId?: string;
  username?: string;
  roundNumber: number; // Add this field
  roundData: any;
  timestamp: Date;
}

// --- Schemas for Sketch-specific data ---
const SketchGameSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  authorUserId: { type: String, required: true },
  authorUsername: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const SketchGameSessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String },
  username: { type: String },
  sketchGameId: { type: String, required: true, index: true },
  startTime: { type: Date, default: Date.now },
  isGuest: { type: Boolean, default: false },
});

const SketchGameDataSchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  sketchGameId: { type: String, required: true },
  userId: { type: String },
  username: { type: String },
  roundNumber: { type: Number, default: 1 }, // Add this field
  roundData: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

// --- Models pointing to new collections ---
export const SketchGameModel: Model<ISketchGame> = 
  mongoose.models.SketchGame || mongoose.model<ISketchGame>("SketchGame", SketchGameSchema, "sketch_games");

export const SketchGameSessionModel: Model<ISketchGameSession> = 
  mongoose.models.SketchGameSession || mongoose.model<ISketchGameSession>("SketchGameSession", SketchGameSessionSchema, "sketch_gamesessions");

export const SketchGameDataModel: Model<ISketchGameData> = 
  mongoose.models.SketchGameData || mongoose.model<ISketchGameData>("SketchGameData", SketchGameDataSchema, "sketch_gamedata");