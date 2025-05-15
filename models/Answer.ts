// models/Answer.ts
import mongoose, { Document, Model } from "mongoose";

interface IAnswer extends Document {
  questionId: string;
  userId: string;
  username: string;
  body: string;
  upvotes: string[]; // Array of userIds who upvoted
  downvotes: string[]; // Array of userIds who downvoted
  isAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  body: { type: String, required: true },
  upvotes: [{ type: String }],
  downvotes: [{ type: String }],
  isAccepted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create index for faster lookup by questionId
AnswerSchema.index({ questionId: 1 });

const AnswerModel = mongoose.models.Answer || mongoose.model("Answer", AnswerSchema);
export default AnswerModel;