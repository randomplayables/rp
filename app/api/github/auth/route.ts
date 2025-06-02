import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser || !clerkUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription status (assuming this logic is still desired)
    const subscriptionCheck = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/check-subscription?userId=${clerkUser.id}`);
    if (!subscriptionCheck.ok) {
        // Handle error from subscription check if necessary
        console.error("Subscription check failed:", await subscriptionCheck.text());
        return NextResponse.json({ error: "Could not verify subscription status." }, { status: 500 });
    }
    const subscriptionData = await subscriptionCheck.json();
    
    if (!subscriptionData.subscriptionActive) {
      return NextResponse.json({ error: "GitHub integration requires an active subscription." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const originatingPath = searchParams.get("origin") || "/profile"; // Default to /profile if not specified

    // Encode userId and originatingPath into the state parameter
    // Using a simple delimiter like '::'
    const stateValue = `${clerkUser.id}::${originatingPath}`;

    const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${process.env.GITHUB_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/api/github/callback`)}&` +
      `scope=repo&` + // Ensure 'repo' scope is sufficient, or adjust as needed (e.g., 'user:email, repo')
      `state=${encodeURIComponent(stateValue)}`; // Encode the state value

    return NextResponse.json({ authUrl: githubAuthUrl });
  } catch (error) {
    console.error("GitHub auth error:", error);
    return NextResponse.json({ error: "Failed to initiate GitHub authentication." }, { status: 500 });
  }
}