import mongoose, { Document, Model } from "mongoose";

interface ISurveyResponse extends Document {
  surveyId: string;
  respondentId?: string; // Optional, for authenticated users
  responses: {
    questionId: string;
    answer: any; // Could be string, number, array, or gameData object
    gameSessionId?: string; // Only present for game questions
  }[];
  metadata: {
    userAgent: string;
    ipAddress: string;
    startTime: Date;
    endTime: Date;
  };
}

const SurveyResponseSchema = new mongoose.Schema({
  surveyId: { type: String, required: true },
  respondentId: { type: String },
  responses: [{
    questionId: { type: String, required: true },
    answer: mongoose.Schema.Types.Mixed,
    gameSessionId: String
  }],
  metadata: {
    userAgent: String,
    ipAddress: String,
    startTime: { type: Date, default: Date.now },
    endTime: Date
  }
});

// Add indices for faster queries
SurveyResponseSchema.index({ surveyId: 1 });

const SurveyResponseModel = mongoose.models.SurveyResponse || 
  mongoose.model("SurveyResponse", SurveyResponseSchema);
export default SurveyResponseModel;