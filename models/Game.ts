import mongoose, { Document, Model } from "mongoose";
import { IGame } from "@/types/Game";

const IRLInstructionSchema = new mongoose.Schema({ /* … */ }, { _id: false });

const GameSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  image: String,
  name: String,
  year: Number,
  link: String,
  irlInstructions: [IRLInstructionSchema],
});

// Notice the generics here: IGame & Document
const GameModel: Model<IGame & Document> =
  mongoose.models.Game || mongoose.model("Game", GameSchema);

export default GameModel;
