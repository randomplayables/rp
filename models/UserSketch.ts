// import mongoose, { Document, Model } from "mongoose";

// interface IUserSketch extends Document {
//   userId: string;
//   username: string;
//   title: string;
//   description: string;
//   code: string;
//   language: string;
//   previewImage?: string;
//   createdAt: Date;
//   updatedAt: Date;
//   isPublic: boolean;
// }

// const UserSketchSchema = new mongoose.Schema({
//   userId: { type: String, required: true, index: true },
//   username: { type: String, required: true },
//   title: { type: String, required: true },
//   description: { type: String },
//   code: { type: String, required: true },
//   language: { type: String, required: true, default: 'html' },
//   previewImage: { type: String },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now },
//   isPublic: { type: Boolean, default: true }
// });

// const UserSketchModel = mongoose.models.UserSketch || 
//   mongoose.model("UserSketch", UserSketchSchema);

// export default UserSketchModel;

import mongoose, { Document, Model } from "mongoose";

interface IUserSketch extends Document {
  userId: string;
  username: string;
  title: string;
  description: string;
  files: mongoose.Schema.Types.Mixed;
  previewImage?: string;
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublic: { type: Boolean, default: true }
});

const UserSketchModel = mongoose.models.UserSketch || 
  mongoose.model("UserSketch", UserSketchSchema);

export default UserSketchModel;