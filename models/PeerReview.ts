import mongoose, { Document, Model, Schema } from "mongoose";

interface IPeerReview extends Document {
  gameId: string;
  reviewerUserId: string;
  reviewerUsername: string;
  pullRequestUrl: string;
  linesAdded: number;
  linesDeleted: number;
  mergedAt: Date;
  createdAt: Date;
}

const PeerReviewSchema = new Schema({
  gameId: { type: String, required: true, index: true },
  reviewerUserId: { type: String, required: true, index: true },
  reviewerUsername: { type: String, required: true },
  pullRequestUrl: { type: String, required: true, unique: true },
  linesAdded: { type: Number, default: 0 },
  linesDeleted: { type: Number, default: 0 },
  mergedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

const PeerReviewModel: Model<IPeerReview> =
  mongoose.models.PeerReview || mongoose.model<IPeerReview>("PeerReview", PeerReviewSchema);

export default PeerReviewModel;