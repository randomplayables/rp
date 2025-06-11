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

//     const { gameTitle, gameDescription, files, repoName, isPrivate = false } = await request.json();

//     if (!gameTitle || !files || !repoName) {
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
//       auto_init: true, // Change this to true to ensure a default branch is created
//     });

//     const repo = repoResponse.data;

//     // Upload files to repository by iterating over the files object
//     for (const filePath in files) {
//       const fileContent = files[filePath];
//       // Sandpack paths start with a '/', remove it for GitHub API
//       const githubPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

//       await octokit.rest.repos.createOrUpdateFileContents({
//         owner: integration.githubUsername,
//         repo: repoName,
//         path: githubPath,
//         message: `feat: Add ${githubPath}`,
//         content: Buffer.from(fileContent).toString('base64'),
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
    
//     if (error.status === 422) {
//       return NextResponse.json({ error: "Repository name already exists, is invalid, or another issue occurred with GitHub's validation." }, { status: 400 });
//     }
    
//     return NextResponse.json({ error: "Failed to upload to GitHub" }, { status: 500 });
//   }
// }


// app/api/github/upload-game/route.ts
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
      auto_init: true, // Change this to true to ensure a default branch is created
    });

    const repo = repoResponse.data;

    // Upload files to repository by iterating over the files object
    for (const filePath in files) {
      const fileContent = files[filePath];
      // Sandpack paths start with a '/', remove it for GitHub API
      const githubPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

      // Determine if the file is binary based on extension
      const isBinary = /\.(png|jpe?g|gif|webp|ico)$/i.test(githubPath);

      // If it's binary, we assume fileContent is already Base64.
      // If not, we encode it from a UTF-8 string.
      const contentForUpload = isBinary ? fileContent : Buffer.from(fileContent, 'utf-8').toString('base64');

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: integration.githubUsername,
        repo: repoName,
        path: githubPath,
        message: `feat: Add ${githubPath}`,
        content: contentForUpload,
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

// // app/api/github/upload-game/route.ts
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

//     const { gameTitle, gameDescription, files, repoName, isPrivate = false } = await request.json();

//     if (!gameTitle || !files || !repoName) {
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
//       auto_init: true,
//     });

//     const repo = repoResponse.data;
    
//     const finalFilesToUpload: Record<string, string> = { ...files };

//     // --- Asset Transformation Logic ---
//     for (const filePath in finalFilesToUpload) {
//         if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
//             let fileContent = finalFilesToUpload[filePath];
            
//             // Regex to find "const varName = 'data:image/...;base64,...';"
//             const dataUriRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*'data:(image\/[^;]+);base64,([^']+)';?/g;
            
//             let match;
//             const newImports: string[] = [];

//             while ((match = dataUriRegex.exec(fileContent)) !== null) {
//                 const [fullMatch, varName, mimeType, base64Data] = match;
                
//                 // 1. Create a new asset file path
//                 const extension = mimeType.split('/')[1] || 'png';
//                 const assetPath = `/src/assets/${varName}.${extension}`;
                
//                 // 2. Add the new asset file to our upload list (with pure base64 content)
//                 finalFilesToUpload[assetPath] = base64Data;
                
//                 // 3. Prepare the import statement to replace the const
//                 newImports.push(`import ${varName} from '.${assetPath.substring(3)}';`); // e.g., './assets/varName.png'
                
//                 // 4. Remove the giant Data URI const from the code
//                 fileContent = fileContent.replace(fullMatch, '');
//             }

//             // 5. If we found assets, prepend the new imports to the file content
//             if (newImports.length > 0) {
//                 finalFilesToUpload[filePath] = newImports.join('\n') + '\n' + fileContent.trim();
//             }
//         }
//     }
//     // --- End of Asset Transformation Logic ---

//     // Upload files to repository by iterating over the processed files
//     for (const filePath in finalFilesToUpload) {
//       const fileContent = finalFilesToUpload[filePath];
//       const githubPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

//       const isBinary = /\.(png|jpe?g|gif|webp|ico)$/i.test(githubPath);
      
//       // If it's binary, content is already base64. If not, encode it.
//       const contentForUpload = isBinary ? fileContent : Buffer.from(fileContent, 'utf-8').toString('base64');

//       await octokit.rest.repos.createOrUpdateFileContents({
//         owner: integration.githubUsername,
//         repo: repoName,
//         path: githubPath,
//         message: `feat: Add ${githubPath}`,
//         content: contentForUpload,
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
    
//     if (error.status === 422) {
//       return NextResponse.json({ error: "Repository name already exists, is invalid, or another issue occurred with GitHub's validation." }, { status: 400 });
//     }
    
//     return NextResponse.json({ error: "Failed to upload to GitHub" }, { status: 500 });
//   }
// }