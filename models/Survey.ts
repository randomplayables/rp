import mongoose, { Document, Model } from "mongoose";

interface ISurvey extends Document {
  userId: string;
  username: string;
  title: string;
  description: string;
  questions: {
    questionId: string;
    type: string; // text, multiple-choice, scale, game, etc.
    text: string;
    options?: string[];
    gameId?: string; // Optional game integration
    required: boolean;
  }[];
  status: 'draft' | 'active' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  shareableLink: string;
}

const SurveySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String },
  title: { type: String, required: true },
  description: { type: String },
  questions: [{
    questionId: { type: String, required: true },
    type: { type: String, required: true },
    text: { type: String, required: true },
    options: [String],
    gameId: String,
    required: { type: Boolean, default: true },
  }],
  status: { type: String, default: 'draft' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  shareableLink: { type: String, unique: true }
});

const SurveyModel = mongoose.models.Survey || mongoose.model("Survey", SurveySchema);
export default SurveyModel;