// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import GameModel from "@/models/Game";
// import GameSubmissionModel from "@/models/GameSubmission";
// import { currentUser } from "@clerk/nextjs/server";
// import { isAdmin } from "@/lib/auth";
// import { incrementUserContribution, ContributionType } from "@/lib/contributionUpdater";
// import { prisma } from "@/lib/prisma";

// export async function POST(request: NextRequest) {
//     try {
//         const clerkUser = await currentUser();
//         if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
//             return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
//         }

//         const body = await request.json();
//         const { submissionId, gameId, link, modelType, isPaid } = body;

//         if (!submissionId) {
//             return NextResponse.json({ error: "Missing required field: submissionId is required." }, { status: 400 });
//         }

//         await connectToDatabase();

//         const submission = await GameSubmissionModel.findById(submissionId);
//         if (!submission) {
//             return NextResponse.json({ error: "Game submission not found." }, { status: 404 });
//         }

//         const { authorUsername } = submission;

//         const authorProfile = await prisma.profile.findUnique({
//             where: { username: authorUsername }
//         });

//         if (!authorProfile) {
//             console.warn(`Could not find profile for username: ${authorUsername}. Contribution points will not be awarded.`);
//         }

//         if (submission.submissionType === 'update') {
//             if (!submission.targetGameId) {
//                  return NextResponse.json({ error: "Update submission is missing a targetGameId." }, { status: 400 });
//             }
//             const gameToUpdate = await GameModel.findOne({ gameId: submission.targetGameId });
//             if (!gameToUpdate) {
//                 return NextResponse.json({ error: `Game with targetGameId '${submission.targetGameId}' not found for update.` }, { status: 404 });
//             }

//             gameToUpdate.name = submission.name;
//             gameToUpdate.description = submission.description;
//             gameToUpdate.year = submission.year;
//             gameToUpdate.image = submission.image;
//             gameToUpdate.version = submission.version;
//             gameToUpdate.irlInstructions = submission.irlInstructions;

//             // Handle AI usage details for updates
//             if (submission.usesAiModels && modelType) {
//                 gameToUpdate.aiUsageDetails = {
//                     modelType: modelType,
//                     isPaid: isPaid || false
//                 };
//             } else {
//                 // If the "uses AI" box was unchecked or no model type provided, remove the details
//                 gameToUpdate.aiUsageDetails = undefined;
//             }

//             await gameToUpdate.save();

//             if (authorProfile) {
//                 await incrementUserContribution(
//                     authorProfile.userId,
//                     authorUsername,
//                     ContributionType.GAME_UPDATE
//                 );
//                 console.log(`Awarded GAME_UPDATE points to ${authorUsername}`);
//             }

//             return NextResponse.json({ success: true, game: gameToUpdate }, { status: 200 });

//         } else {
//             if (!gameId) {
//                 return NextResponse.json({ error: "Missing gameId for initial submission." }, { status: 400 });
//             }
//             const existingGame = await GameModel.findOne({ gameId: gameId });
//             if (existingGame) {
//                 return NextResponse.json({ error: `Game with gameId '${gameId}' already exists.` }, { status: 409 });
//             }

//             const newGameData: any = {
//                 gameId: gameId,
//                 link: link,
//                 name: submission.name,
//                 description: submission.description,
//                 year: submission.year,
//                 image: submission.image,
//                 version: submission.version,
//                 codeUrl: submission.codeUrl,
//                 irlInstructions: submission.irlInstructions,
//                 authorUsername: submission.authorUsername
//             };

//             if (submission.usesAiModels && modelType) {
//                 newGameData.aiUsageDetails = {
//                     modelType: modelType,
//                     isPaid: isPaid || false
//                 };
//             }

//             const newGame = await GameModel.create(newGameData);

//             if (authorProfile) {
//                 await incrementUserContribution(
//                     authorProfile.userId,
//                     authorUsername,
//                     ContributionType.GAME_PUBLICATION
//                 );
//                 console.log(`Awarded GAME_PUBLICATION points to ${authorUsername}`);
//             }

//             return NextResponse.json({ success: true, game: newGame }, { status: 201 });
//         }

//     } catch (error: any) {
//         console.error("Error promoting game from submission:", error);
//         return NextResponse.json({
//             error: "Failed to promote game",
//             details: error.message
//         }, { status: 500 });
//     }
// }



// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import GameModel from "@/models/Game";
// import GameSubmissionModel from "@/models/GameSubmission";
// import { currentUser } from "@clerk/nextjs/server";
// import { isAdmin } from "@/lib/auth";
// import { incrementUserContribution, ContributionType } from "@/lib/contributionUpdater";
// import { prisma } from "@/lib/prisma";

// export async function POST(request: NextRequest) {
//     try {
//         const clerkUser = await currentUser();
//         if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
//             return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
//         }

//         const body = await request.json();
//         const { submissionId, gameId, link, modelType, isPaid } = body;

//         if (!submissionId) {
//             return NextResponse.json({ error: "Missing required field: submissionId is required." }, { status: 400 });
//         }

//         await connectToDatabase();

//         const submission = await GameSubmissionModel.findById(submissionId);
//         if (!submission) {
//             return NextResponse.json({ error: "Game submission not found." }, { status: 404 });
//         }

//         const { authorUsername } = submission;

//         const authorProfile = await prisma.profile.findUnique({
//             where: { username: authorUsername }
//         });

//         if (!authorProfile) {
//             console.warn(`Could not find profile for username: ${authorUsername}. Contribution points will not be awarded.`);
//         }

//         if (submission.submissionType === 'update') {
//             if (!submission.targetGameId) {
//                  return NextResponse.json({ error: "Update submission is missing a targetGameId." }, { status: 400 });
//             }
//             const gameToUpdate = await GameModel.findOne({ gameId: submission.targetGameId });
//             if (!gameToUpdate) {
//                 return NextResponse.json({ error: `Game with targetGameId '${submission.targetGameId}' not found for update.` }, { status: 404 });
//             }

//             gameToUpdate.name = submission.name;
//             gameToUpdate.description = submission.description;
//             gameToUpdate.year = submission.year;
//             gameToUpdate.image = submission.image;
//             gameToUpdate.version = submission.version;
//             gameToUpdate.irlInstructions = submission.irlInstructions;
//             gameToUpdate.tags = submission.tags;

//             // Handle AI usage details for updates
//             if (submission.usesAiModels && modelType) {
//                 gameToUpdate.aiUsageDetails = {
//                     modelType: modelType,
//                     isPaid: isPaid || false
//                 };
//             } else {
//                 // If the "uses AI" box was unchecked or no model type provided, remove the details
//                 gameToUpdate.aiUsageDetails = undefined;
//             }

//             await gameToUpdate.save();

//             if (authorProfile) {
//                 await incrementUserContribution(
//                     authorProfile.userId,
//                     authorUsername,
//                     ContributionType.GAME_UPDATE
//                 );
//                 console.log(`Awarded GAME_UPDATE points to ${authorUsername}`);
//             }

//             return NextResponse.json({ success: true, game: gameToUpdate }, { status: 200 });

//         } else {
//             if (!gameId) {
//                 return NextResponse.json({ error: "Missing gameId for initial submission." }, { status: 400 });
//             }
//             const existingGame = await GameModel.findOne({ gameId: gameId });
//             if (existingGame) {
//                 return NextResponse.json({ error: `Game with gameId '${gameId}' already exists.` }, { status: 409 });
//             }

//             const newGameData: any = {
//                 gameId: gameId,
//                 link: link,
//                 name: submission.name,
//                 description: submission.description,
//                 year: submission.year,
//                 image: submission.image,
//                 version: submission.version,
//                 codeUrl: submission.codeUrl,
//                 irlInstructions: submission.irlInstructions,
//                 authorUsername: submission.authorUsername,
//                 tags: submission.tags
//             };

//             if (submission.usesAiModels && modelType) {
//                 newGameData.aiUsageDetails = {
//                     modelType: modelType,
//                     isPaid: isPaid || false
//                 };
//             }

//             const newGame = await GameModel.create(newGameData);

//             if (authorProfile) {
//                 await incrementUserContribution(
//                     authorProfile.userId,
//                     authorUsername,
//                     ContributionType.GAME_PUBLICATION
//                 );
//                 console.log(`Awarded GAME_PUBLICATION points to ${authorUsername}`);
//             }

//             return NextResponse.json({ success: true, game: newGame }, { status: 201 });
//         }

//     } catch (error: any) {
//         console.error("Error promoting game from submission:", error);
//         return NextResponse.json({
//             error: "Failed to promote game",
//             details: error.message
//         }, { status: 500 });
//     }
// }







// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import GameModel from "@/models/Game";
// import GameSubmissionModel from "@/models/GameSubmission";
// import { currentUser } from "@clerk/nextjs/server";
// import { isAdmin } from "@/lib/auth";
// import { incrementUserContribution, ContributionType } from "@/lib/contributionUpdater";
// import { prisma } from "@/lib/prisma";

// export async function POST(request: NextRequest) {
//     try {
//         const clerkUser = await currentUser();
//         if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
//             return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
//         }

//         const body = await request.json();
//         const { submissionId, gameId, link, modelType, isPaid } = body;

//         if (!submissionId) {
//             return NextResponse.json({ error: "Missing required field: submissionId is required." }, { status: 400 });
//         }

//         await connectToDatabase();

//         const submission = await GameSubmissionModel.findById(submissionId);
//         if (!submission) {
//             return NextResponse.json({ error: "Game submission not found." }, { status: 404 });
//         }

//         const { authorUsername } = submission;

//         const authorProfile = await prisma.profile.findUnique({
//             where: { username: authorUsername }
//         });

//         if (!authorProfile) {
//             console.warn(`Could not find profile for username: ${authorUsername}. Contribution points will not be awarded.`);
//         }

//         if (submission.submissionType === 'update') {
//             if (!submission.targetGameId) {
//                  return NextResponse.json({ error: "Update submission is missing a targetGameId." }, { status: 400 });
//             }
            
//             const updatePayload: any = {
//                 $set: {
//                     name: submission.name,
//                     description: submission.description,
//                     year: submission.year,
//                     image: submission.image,
//                     version: submission.version,
//                     irlInstructions: submission.irlInstructions,
//                     tags: submission.tags || []
//                 }
//             };
            
//             if (submission.usesAiModels && modelType) {
//                 updatePayload.$set.aiUsageDetails = {
//                     modelType: modelType,
//                     isPaid: isPaid || false
//                 };
//             } else {
//                 updatePayload.$unset = { aiUsageDetails: "" };
//             }

//             const gameToUpdate = await GameModel.findOneAndUpdate(
//                 { gameId: submission.targetGameId },
//                 updatePayload,
//                 { new: true }
//             );

//             if (!gameToUpdate) {
//                 return NextResponse.json({ error: `Game with targetGameId '${submission.targetGameId}' not found for update.` }, { status: 404 });
//             }

//             if (authorProfile) {
//                 await incrementUserContribution(
//                     authorProfile.userId,
//                     authorUsername,
//                     ContributionType.GAME_UPDATE
//                 );
//                 console.log(`Awarded GAME_UPDATE points to ${authorUsername}`);
//             }

//             return NextResponse.json({ success: true, game: gameToUpdate }, { status: 200 });

//         } else {
//             if (!gameId) {
//                 return NextResponse.json({ error: "Missing gameId for initial submission." }, { status: 400 });
//             }
//             const existingGame = await GameModel.findOne({ gameId: gameId });
//             if (existingGame) {
//                 return NextResponse.json({ error: `Game with gameId '${gameId}' already exists.` }, { status: 409 });
//             }

//             const newGameData: any = {
//                 gameId: gameId,
//                 link: link,
//                 name: submission.name,
//                 description: submission.description,
//                 year: submission.year,
//                 image: submission.image,
//                 version: submission.version,
//                 codeUrl: submission.codeUrl,
//                 irlInstructions: submission.irlInstructions,
//                 authorUsername: submission.authorUsername,
//                 tags: submission.tags || []
//             };

//             if (submission.usesAiModels && modelType) {
//                 newGameData.aiUsageDetails = {
//                     modelType: modelType,
//                     isPaid: isPaid || false
//                 };
//             }

//             const newGame = await GameModel.create(newGameData);

//             if (authorProfile) {
//                 await incrementUserContribution(
//                     authorProfile.userId,
//                     authorUsername,
//                     ContributionType.GAME_PUBLICATION
//                 );
//                 console.log(`Awarded GAME_PUBLICATION points to ${authorUsername}`);
//             }

//             return NextResponse.json({ success: true, game: newGame }, { status: 201 });
//         }

//     } catch (error: any) {
//         console.error("Error promoting game from submission:", error);
//         return NextResponse.json({
//             error: "Failed to promote game",
//             details: error.message
//         }, { status: 500 });
//     }
// }






import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import GameSubmissionModel from "@/models/GameSubmission";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import { incrementUserContribution, ContributionType } from "@/lib/contributionUpdater";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { submissionId, gameId, link, modelType, isPaid, tags } = body;

        if (!submissionId) {
            return NextResponse.json({ error: "Missing required field: submissionId is required." }, { status: 400 });
        }

        await connectToDatabase();

        const submission = await GameSubmissionModel.findById(submissionId);
        if (!submission) {
            return NextResponse.json({ error: "Game submission not found." }, { status: 404 });
        }

        const { authorUsername } = submission;

        const authorProfile = await prisma.profile.findUnique({
            where: { username: authorUsername }
        });

        if (!authorProfile) {
            console.warn(`Could not find profile for username: ${authorUsername}. Contribution points will not be awarded.`);
        }

        if (submission.submissionType === 'update') {
            if (!submission.targetGameId) {
                 return NextResponse.json({ error: "Update submission is missing a targetGameId." }, { status: 400 });
            }
            
            const updatePayload: any = {
                $set: {
                    name: submission.name,
                    description: submission.description,
                    year: submission.year,
                    image: submission.image,
                    version: submission.version,
                    irlInstructions: submission.irlInstructions,
                    tags: tags || submission.tags || []
                }
            };
            
            if (submission.usesAiModels && modelType) {
                updatePayload.$set.aiUsageDetails = {
                    modelType: modelType,
                    isPaid: isPaid || false
                };
            } else {
                updatePayload.$unset = { aiUsageDetails: "" };
            }

            const gameToUpdate = await GameModel.findOneAndUpdate(
                { gameId: submission.targetGameId },
                updatePayload,
                { new: true }
            );

            if (!gameToUpdate) {
                return NextResponse.json({ error: `Game with targetGameId '${submission.targetGameId}' not found for update.` }, { status: 404 });
            }

            if (authorProfile) {
                await incrementUserContribution(
                    authorProfile.userId,
                    authorUsername,
                    ContributionType.GAME_UPDATE
                );
                console.log(`Awarded GAME_UPDATE points to ${authorUsername}`);
            }

            return NextResponse.json({ success: true, game: gameToUpdate }, { status: 200 });

        } else {
            if (!gameId) {
                return NextResponse.json({ error: "Missing gameId for initial submission." }, { status: 400 });
            }
            const existingGame = await GameModel.findOne({ gameId: gameId });
            if (existingGame) {
                return NextResponse.json({ error: `Game with gameId '${gameId}' already exists.` }, { status: 409 });
            }

            const newGameData: any = {
                gameId: gameId,
                link: link,
                name: submission.name,
                description: submission.description,
                year: submission.year,
                image: submission.image,
                version: submission.version,
                codeUrl: submission.codeUrl,
                irlInstructions: submission.irlInstructions,
                authorUsername: submission.authorUsername,
                tags: tags || submission.tags || []
            };

            if (submission.usesAiModels && modelType) {
                newGameData.aiUsageDetails = {
                    modelType: modelType,
                    isPaid: isPaid || false
                };
            }

            const newGame = await GameModel.create(newGameData);

            if (authorProfile) {
                await incrementUserContribution(
                    authorProfile.userId,
                    authorUsername,
                    ContributionType.GAME_PUBLICATION
                );
                console.log(`Awarded GAME_PUBLICATION points to ${authorUsername}`);
            }

            return NextResponse.json({ success: true, game: newGame }, { status: 201 });
        }

    } catch (error: any) {
        console.error("Error promoting game from submission:", error);
        return NextResponse.json({
            error: "Failed to promote game",
            details: error.message
        }, { status: 500 });
    }
}