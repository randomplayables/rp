import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription status
    const subscriptionCheck = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/check-subscription?userId=${clerkUser.id}`);
    const subscriptionData = await subscriptionCheck.json();
    
    if (!subscriptionData.subscriptionActive) {
      return NextResponse.json({ error: "GitHub integration requires an active subscription" }, { status: 403 });
    }

    // Generate GitHub OAuth URL
    const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${process.env.GITHUB_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/api/github/callback`)}&` +
      `scope=repo&` +
      `state=${clerkUser.id}`;

    return NextResponse.json({ authUrl: githubAuthUrl });
  } catch (error) {
    console.error("GitHub auth error:", error);
    return NextResponse.json({ error: "Failed to initiate GitHub authentication" }, { status: 500 });
  }
}