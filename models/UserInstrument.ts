import mongoose, { Document, Model } from "mongoose";

interface IUserInstrument extends Document {
  userId: string;
  username: string;
  title: string;
  description: string;
  surveyId: string;
  questionCount: number;
  responseCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  shareableLink: string;
}

const UserInstrumentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  surveyId: { type: String, required: true },
  questionCount: { type: Number, default: 0 },
  responseCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true },
  shareableLink: { type: String, required: true }
});

const UserInstrumentModel = mongoose.models.UserInstrument || 
  mongoose.model("UserInstrument", UserInstrumentSchema);

export default UserInstrumentModel;