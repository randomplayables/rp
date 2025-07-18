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

    const subscriptionCheck = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/check-subscription?userId=${clerkUser.id}`);
    const subscriptionData = await subscriptionCheck.json();
    
    if (!subscriptionData.subscriptionActive) {
      return NextResponse.json({ error: "GitHub integration requires an active subscription" }, { status: 403 });
    }

    const { gameTitle, gameDescription, files, repoName, isPrivate = false } = await request.json();

    if (!gameTitle || !files || !repoName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectToDatabase();
    const integration = await GitHubIntegrationModel.findOne({ userId: clerkUser.id });
    
    if (!integration) {
      return NextResponse.json({ error: "GitHub not connected. Please connect your GitHub account first." }, { status: 400 });
    }

    const octokit = new Octokit({
      auth: integration.accessToken,
    });

    // Create repository
    const repoResponse = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: gameDescription || `${gameTitle} - Created with RandomPlayables GameLab`,
      private: isPrivate,
      auto_init: false, // *** FIX: Create a completely empty repository ***
    });

    const repo = repoResponse.data;
    const finalFilesToUpload = { ...files };

    // This loop will now succeed because the repository is empty.
    for (const filePath in finalFilesToUpload) {
      let fileContent = finalFilesToUpload[filePath];
      if(typeof fileContent === 'object' && fileContent.code) {
        fileContent = fileContent.code;
      }
      
      if(typeof fileContent !== 'string') continue;

      const githubPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: integration.githubUsername,
        repo: repoName,
        path: githubPath,
        message: `feat: Add ${githubPath}`,
        content: Buffer.from(fileContent, 'utf-8').toString('base64'),
      });
    }

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
    
    return NextResponse.json({ error: "Failed to upload to GitHub", details: error.message, stack: error.stack }, { status: 500 });
  }
}