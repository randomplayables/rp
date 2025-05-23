import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { GitHubIntegrationModel } from "@/models/GitHubIntegration";

export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const integration = await GitHubIntegrationModel.findOne({ userId: clerkUser.id });

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      githubUsername: integration.githubUsername,
      connectedAt: integration.connectedAt,
      lastUsed: integration.lastUsed,
    });

  } catch (error) {
    console.error("GitHub status error:", error);
    return NextResponse.json({ error: "Failed to check GitHub status" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    await GitHubIntegrationModel.deleteOne({ userId: clerkUser.id });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("GitHub disconnect error:", error);
    return NextResponse.json({ error: "Failed to disconnect GitHub" }, { status: 500 });
  }
}