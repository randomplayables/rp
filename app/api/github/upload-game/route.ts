// import { NextRequest, NextResponse } from "next/server";
// import { currentUser } from "@clerk/nextjs/server";
// import { connectToDatabase } from "@/lib/mongodb";
// import GitHubIntegrationModel from "@/models/GitHubIntegration";
// import { Octokit } from "@octokit/rest";

// export async function POST(request: NextRequest) {
//   try {
//     const clerkUser = await currentUser();
//     if (!clerkUser) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // Check subscription
//     const subscriptionCheck = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/check-subscription?userId=${clerkUser.id}`);
//     const subscriptionData = await subscriptionCheck.json();
    
//     if (!subscriptionData.subscriptionActive) {
//       return NextResponse.json({ error: "GitHub integration requires an active subscription" }, { status: 403 });
//     }

//     const { gameTitle, gameDescription, gameCode, repoName, isPrivate = false } = await request.json();

//     if (!gameTitle || !gameCode || !repoName) {
//       return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
//     }

//     // Get GitHub integration
//     await connectToDatabase();
//     const integration = await GitHubIntegrationModel.findOne({ userId: clerkUser.id });
    
//     if (!integration) {
//       return NextResponse.json({ error: "GitHub not connected. Please connect your GitHub account first." }, { status: 400 });
//     }

//     // Initialize Octokit with user's access token
//     const octokit = new Octokit({
//       auth: integration.accessToken,
//     });

//     // Create repository
//     const repoResponse = await octokit.rest.repos.createForAuthenticatedUser({
//       name: repoName,
//       description: gameDescription || `${gameTitle} - Created with RandomPlayables GameLab`,
//       private: isPrivate,
//       auto_init: false, // MODIFIED: Set to false to prevent initial README.md
//     });

//     const repo = repoResponse.data;

//     // Prepare game files (this already includes README.md)
//     const files = prepareGameFiles(gameCode, gameTitle, gameDescription);

//     // Upload files to repository
//     for (const file of files) {
//       await octokit.rest.repos.createOrUpdateFileContents({
//         owner: integration.githubUsername,
//         repo: repoName,
//         path: file.path,
//         message: `Add ${file.path}`, // Commit message for each file
//         content: Buffer.from(file.content).toString('base64'),
//       });
//     }

//     // Update last used timestamp
//     await GitHubIntegrationModel.updateOne(
//       { userId: clerkUser.id },
//       { lastUsed: new Date() }
//     );

//     return NextResponse.json({
//       success: true,
//       repositoryUrl: repo.html_url,
//       repositoryName: repo.full_name,
//     });

//   } catch (error: any) {
//     console.error("GitHub upload error:", error);
    
//     // Handle specific GitHub API errors
//     // This 422 check might still be relevant for truly invalid repo names
//     // or other 422 errors not related to file conflicts.
//     if (error.status === 422) {
//       // It's possible the repo name is genuinely taken if createForAuthenticatedUser failed before auto_init change,
//       // or other validation issue from GitHub.
//       return NextResponse.json({ error: "Repository name already exists, is invalid, or another issue occurred with GitHub's validation." }, { status: 400 });
//     }
    
//     return NextResponse.json({ error: "Failed to upload to GitHub" }, { status: 500 });
//   }
// }

// function prepareGameFiles(gameCode: string, title: string, description: string) {
//   const files = [];

//   // Main game file
//   if (gameCode.includes('<!DOCTYPE html>') || gameCode.includes('<html')) {
//     // Full HTML file
//     files.push({
//       path: 'index.html',
//       content: gameCode
//     });
//   } else {
//     // JavaScript only - create HTML wrapper
//     files.push({
//       path: 'index.html',
//       content: `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>${title}</title>
//     <style>
//         body, html { 
//             margin: 0; 
//             padding: 0; 
//             width: 100%; 
//             height: 100%; 
//             overflow: hidden; 
//         }
//         #game-container { 
//             width: 100%; 
//             height: 100%; 
//         }
//     </style>
// </head>
// <body>
//     <div id="game-container"></div>
//     <script src="game.js"></script>
// </body>
// </html>`
//     });

//     files.push({
//       path: 'game.js',
//       content: gameCode
//     });
//   }

//   // README.md
//   files.push({
//     path: 'README.md',
//     content: `# ${title}

// ${description || 'A game created with RandomPlayables GameLab'}

// ## How to Play

// Open \`index.html\` in your web browser to play the game.

// ## About

// This game was created using [RandomPlayables](https://randomplayables.com) GameLab, a platform for creating mathematical citizen science games.

// ## License

// This project is open source. Feel free to modify and share!
// `
//   });

//   return files;
// }

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import GitHubIntegrationModel from "@/models/GitHubIntegration";
import { Octokit } from "@octokit/rest";

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription
    const subscriptionCheck = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/check-subscription?userId=${clerkUser.id}`);
    const subscriptionData = await subscriptionCheck.json();
    
    if (!subscriptionData.subscriptionActive) {
      return NextResponse.json({ error: "GitHub integration requires an active subscription" }, { status: 403 });
    }

    const { gameTitle, gameDescription, files, repoName, isPrivate = false } = await request.json();

    if (!gameTitle || !files || !repoName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get GitHub integration
    await connectToDatabase();
    const integration = await GitHubIntegrationModel.findOne({ userId: clerkUser.id });
    
    if (!integration) {
      return NextResponse.json({ error: "GitHub not connected. Please connect your GitHub account first." }, { status: 400 });
    }

    // Initialize Octokit with user's access token
    const octokit = new Octokit({
      auth: integration.accessToken,
    });

    // Create repository
    const repoResponse = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: gameDescription || `${gameTitle} - Created with RandomPlayables GameLab`,
      private: isPrivate,
      auto_init: false,
    });

    const repo = repoResponse.data;

    // Upload files to repository by iterating over the files object
    for (const filePath in files) {
      const fileContent = files[filePath];
      // Sandpack paths start with a '/', remove it for GitHub API
      const githubPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: integration.githubUsername,
        repo: repoName,
        path: githubPath,
        message: `feat: Add ${githubPath}`,
        content: Buffer.from(fileContent).toString('base64'),
      });
    }

    // Update last used timestamp
    await GitHubIntegrationModel.updateOne(
      { userId: clerkUser.id },
      { lastUsed: new Date() }
    );

    return NextResponse.json({
      success: true,
      repositoryUrl: repo.html_url,
      repositoryName: repo.full_name,
    });

  } catch (error: any) {
    console.error("GitHub upload error:", error);
    
    if (error.status === 422) {
      return NextResponse.json({ error: "Repository name already exists, is invalid, or another issue occurred with GitHub's validation." }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Failed to upload to GitHub" }, { status: 500 });
  }
}