import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GitHubIntegrationModel from "@/models/GitHubIntegration";

export async function GET(request: NextRequest) {
  const baseRedirectUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let finalRedirectPath = '/profile'; // Default redirect
  let userIdFromState: string | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const encodedState = searchParams.get("state");

    if (!code || !encodedState) {
      console.error("GitHub callback error: Missing code or state.");
      return NextResponse.redirect(`${baseRedirectUrl}${finalRedirectPath}?error=github_auth_failed`);
    }

    const stateValue = decodeURIComponent(encodedState);
    const [extractedUserId, extractedOriginPath] = stateValue.split('::');

    userIdFromState = extractedUserId; // For saving integration
    if (extractedOriginPath) {
        finalRedirectPath = extractedOriginPath; // For redirecting
    }

    if (!userIdFromState) {
        console.error("GitHub callback error: Could not extract userId from state.", { stateValue });
        return NextResponse.redirect(`${baseRedirectUrl}${finalRedirectPath}?error=github_auth_invalid_state`);
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("GitHub callback error: Token exchange failed.", tokenData);
      return NextResponse.redirect(`${baseRedirectUrl}${finalRedirectPath}?error=github_token_failed&error_description=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: { "Authorization": `Bearer ${tokenData.access_token}`, "Accept": "application/vnd.github+json" },
    });
    if (!userResponse.ok) {
        const errorData = await userResponse.json();
        console.error("GitHub callback error: Failed to fetch GitHub user info.", errorData);
        return NextResponse.redirect(`${baseRedirectUrl}${finalRedirectPath}?error=github_user_fetch_failed`);
    }
    const githubUser = await userResponse.json();

    await connectToDatabase();
    await GitHubIntegrationModel.findOneAndUpdate(
      { userId: userIdFromState },
      {
        githubUsername: githubUser.login,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        connectedAt: new Date(),
        lastUsed: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.redirect(`${baseRedirectUrl}${finalRedirectPath}?github_connected=true`);
  } catch (error) {
    console.error("GitHub callback critical error:", error);
    // Use finalRedirectPath which might have been updated if state parsing was partially successful
    return NextResponse.redirect(`${baseRedirectUrl}${finalRedirectPath}?error=github_callback_failed`);
  }
}