import mongoose, { Document, Model } from "mongoose";

interface IQuestion extends Document {
  userId: string;
  username: string;
  title: string;
  body: string;
  tags: string[];
  upvotes: string[]; // Array of userIds who upvoted
  downvotes: string[]; // Array of userIds who downvoted
  views: number;
  acceptedAnswerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  tags: [{ type: String }],
  upvotes: [{ type: String }],
  downvotes: [{ type: String }],
  views: { type: Number, default: 0 },
  acceptedAnswerId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const QuestionModel = mongoose.models.Question || mongoose.model("Question", QuestionSchema);
export default QuestionModel;