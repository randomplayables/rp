import mongoose, { Document, Model } from "mongoose";

interface IUserSketch extends Document {
  userId: string;
  username: string;
  title: string;
  description?: string;
  files: mongoose.Schema.Types.Mixed;
  previewImage?: string;
  gameId?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
}

const UserSketchSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  files: { type: mongoose.Schema.Types.Mixed, required: true },
  previewImage: { type: String },
  gameId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

const UserSketchModel: Model<IUserSketch> = mongoose.models.UserSketch || 
  mongoose.model("UserSketch", UserSketchSchema);

export default UserSketchModel;