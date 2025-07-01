// import mongoose, { Document, Model, Schema } from "mongoose";

// interface IGameSubmission extends Document {
//   name: string;
//   description?: string;
//   year: number;
//   image: string;
//   version: string;
//   codeUrl: string;
//   irlInstructions?: { title: string; url: string }[];
//   authorUsername: string;
//   authorEmail: string;
//   submittedByUserId: string;
//   status: 'pending' | 'approved' | 'rejected';
//   isPeerReviewEnabled: boolean;
//   submittedAt: Date;
//   reviewerNotes?: string;
//   // Fields for resubmission handling
//   submissionType: 'initial' | 'update';
//   targetGameId?: string; // gameId of the game being updated
//   previousVersion?: string;
//   usesAiModels: boolean;
// }

// const GameSubmissionSchema = new Schema({
//   name: { type: String, required: true },
//   description: { type: String },
//   year: { type: Number, required: true },
//   image: { type: String, required: true },
//   version: { type: String, required: true },
//   codeUrl: { type: String, required: true },
//   irlInstructions: [{
//     title: String,
//     url: String,
//     _id: false
//   }],
//   authorUsername: { type: String, required: true },
//   authorEmail: { type: String, required: true },
//   submittedByUserId: { type: String, required: true },
//   status: {
//     type: String,
//     enum: ['pending', 'approved', 'rejected'],
//     default: 'pending',
//   },
//   isPeerReviewEnabled: { type: Boolean, default: false },
//   submittedAt: { type: Date, default: Date.now },
//   reviewerNotes: { type: String },
//   // Fields for resubmission handling
//   submissionType: {
//     type: String,
//     enum: ['initial', 'update'],
//     default: 'initial'
//   },
//   targetGameId: {
//     type: String,
//   },
//   previousVersion: {
//     type: String,
//   },
//   usesAiModels: { type: Boolean, default: false },
// });

// // Create index for easier querying by status or user
// GameSubmissionSchema.index({ status: 1 });
// GameSubmissionSchema.index({ submittedByUserId: 1 });

// const GameSubmissionModel: Model<IGameSubmission> =
//   mongoose.models.GameSubmission || mongoose.model<IGameSubmission>("GameSubmission", GameSubmissionSchema);

// export default GameSubmissionModel;




import mongoose, { Document, Model, Schema } from "mongoose";

interface IGameSubmission extends Document {
  name: string;
  description?: string;
  year: number;
  image: string;
  version: string;
  codeUrl: string;
  irlInstructions?: { title: string; url: string }[];
  authorUsername: string;
  authorEmail: string;
  submittedByUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  isPeerReviewEnabled: boolean;
  submittedAt: Date;
  reviewerNotes?: string;
  // Fields for resubmission handling
  submissionType: 'initial' | 'update';
  targetGameId?: string; // gameId of the game being updated
  previousVersion?: string;
  usesAiModels: boolean;
  tags?: string[];
}

const GameSubmissionSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  year: { type: Number, required: true },
  image: { type: String, required: true },
  version: { type: String, required: true },
  codeUrl: { type: String, required: true },
  irlInstructions: [{
    title: String,
    url: String,
    _id: false
  }],
  authorUsername: { type: String, required: true },
  authorEmail: { type: String, required: true },
  submittedByUserId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  isPeerReviewEnabled: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now },
  reviewerNotes: { type: String },
  // Fields for resubmission handling
  submissionType: {
    type: String,
    enum: ['initial', 'update'],
    default: 'initial'
  },
  targetGameId: {
    type: String,
  },
  previousVersion: {
    type: String,
  },
  usesAiModels: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
});

// Create index for easier querying by status or user
GameSubmissionSchema.index({ status: 1 });
GameSubmissionSchema.index({ submittedByUserId: 1 });

const GameSubmissionModel: Model<IGameSubmission> =
  mongoose.models.GameSubmission || mongoose.model<IGameSubmission>("GameSubmission", GameSubmissionSchema);

export default GameSubmissionModel;