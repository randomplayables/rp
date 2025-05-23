import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GitHubIntegrationModel } from "@/models/GitHubIntegration";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // This is the userId
    
    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/gamelab?error=github_auth_failed`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/gamelab?error=github_token_failed`);
    }

    // Get GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Accept": "application/vnd.github+json",
      },
    });

    const githubUser = await userResponse.json();

    // Save integration to database
    await connectToDatabase();
    await GitHubIntegrationModel.findOneAndUpdate(
      { userId: state },
      {
        githubUsername: githubUser.login,
        accessToken: tokenData.access_token, // TODO: Encrypt this in production
        refreshToken: tokenData.refresh_token,
        connectedAt: new Date(),
        lastUsed: new Date(),
      },
      { upsert: true }
    );

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/gamelab?github_connected=true`);
  } catch (error) {
    console.error("GitHub callback error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/gamelab?error=github_callback_failed`);
  }
}