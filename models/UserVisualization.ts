import mongoose, { Document, Model } from "mongoose";

interface IUserVisualization extends Document {
  userId: string;
  username: string;
  title: string;
  description: string;
  code: string;
  previewImage?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
}

const UserVisualizationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  code: { type: String, required: true },
  previewImage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

const UserVisualizationModel = mongoose.models.UserVisualization || 
  mongoose.model("UserVisualization", UserVisualizationSchema);

export default UserVisualizationModel;