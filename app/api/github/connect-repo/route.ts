// import { NextRequest, NextResponse } from "next/server";
// import { currentUser } from "@clerk/nextjs/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import GameSubmissionModel from "@/models/GameSubmission";

// export async function POST(request: NextRequest) {
//   try {
//     const clerkUser = await currentUser();
//     if (!clerkUser) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { gameId, repoUrl } = await request.json();

//     if (!gameId || !repoUrl) {
//       return NextResponse.json({ error: "Game ID and repository URL are required." }, { status: 400 });
//     }

//     await connectToDatabase();

//     const gameSubmission = await GameSubmissionModel.findOne({ _id: gameId, submittedByUserId: clerkUser.id });
    
//     if (!gameSubmission) {
//       return NextResponse.json({ error: "Game not found or you are not the author." }, { status: 404 });
//     }

//     // Pass the game submission ID in the `state` parameter to identify it upon callback
//     const gitHubAppInstallationUrl = `https://github.com/apps/rp-peerreview/installations/new?state=${gameId}`;

//     console.log(`User ${clerkUser.username} initiated repository connection for game submission ${gameId} with repo ${repoUrl}.`);
//     console.log(`Generated installation URL: ${gitHubAppInstallationUrl}`);

//     return NextResponse.json({ success: true, installationUrl: gitHubAppInstallationUrl });

//   } catch (error: any) {
//     console.error("Error creating GitHub App installation link:", error);
//     return NextResponse.json({
//       error: "Failed to create installation link",
//       details: error.message
//     }, { status: 500 });
//   }
// }







import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSubmissionModel from "@/models/GameSubmission";

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId, repoUrl } = await request.json();
    const appName = process.env.GITHUB_APP_NAME; // Read the app name from environment variables

    if (!appName) {
        console.error("GITHUB_APP_NAME environment variable is not set.");
        return NextResponse.json({ error: "GitHub App integration is not configured on the server." }, { status: 500 });
    }

    if (!gameId || !repoUrl) {
      return NextResponse.json({ error: "Game ID and repository URL are required." }, { status: 400 });
    }

    await connectToDatabase();

    const gameSubmission = await GameSubmissionModel.findOne({ _id: gameId, submittedByUserId: clerkUser.id });
    
    if (!gameSubmission) {
      return NextResponse.json({ error: "Game not found or you are not the author." }, { status: 404 });
    }

    // Use the environment variable to build the URL
    const gitHubAppInstallationUrl = `https://github.com/apps/${appName}/installations/new?state=${gameId}`;

    console.log(`User ${clerkUser.username} initiated repository connection for game submission ${gameId} with repo ${repoUrl}.`);
    console.log(`Generated installation URL: ${gitHubAppInstallationUrl}`);

    return NextResponse.json({ success: true, installationUrl: gitHubAppInstallationUrl });

  } catch (error: any) {
    console.error("Error creating GitHub App installation link:", error);
    return NextResponse.json({
      error: "Failed to create installation link",
      details: error.message
    }, { status: 500 });
  }
}