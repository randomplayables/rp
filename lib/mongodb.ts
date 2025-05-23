import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load .env.local variables
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

// export async function connectToDatabase() {
//   if (cached.conn) return cached.conn;
//   if (!cached.promise) {
//     cached.promise = mongoose.connect(MONGODB_URI!, { dbName: "Game" }).then((mongoose) => mongoose);
//     // cached.promise = mongoose
//   }
//   cached.conn = await cached.promise;
//   return cached.conn;
// }

// In lib/mongodb.ts
export async function connectToDatabase() {
  if (cached.conn) {
    console.log("Using cached MongoDB connection");
    return cached.conn;
  }
  
  if (!cached.promise) {
    console.log("Connecting to MongoDB with URI:", MONGODB_URI?.substring(0, 20) + "...");
    cached.promise = mongoose.connect(MONGODB_URI!, { dbName: "Game" }).then((mongoose) => {
      console.log("MongoDB connection successful");
      return mongoose;
    }).catch(error => {
      console.error("MongoDB connection error:", error);
      throw error;
    });
  }
  
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error("Failed to establish MongoDB connection:", error);
    throw error;
  }
}

// const GitHubIntegrationSchema = new mongoose.Schema({
//   userId: { type: String, required: true, unique: true },
//   githubUsername: { type: String, required: true },
//   accessToken: { type: String, required: true }, // Encrypted in production
//   refreshToken: { type: String },
//   connectedAt: { type: Date, default: Date.now },
//   lastUsed: { type: Date, default: Date.now }
// });

// export const GitHubIntegrationModel = mongoose.models.GitHubIntegration || 
//   mongoose.model("GitHubIntegration", GitHubIntegrationSchema);