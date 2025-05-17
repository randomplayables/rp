// app/api/rp/probability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getUserWinProbability } from "@/lib/payablesEngine";
import { currentUser } from "@clerk/nextjs/server";

/**
 * GET endpoint to retrieve a user's win probability
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");
    const requestedUsername = searchParams.get("username");
    
    await connectToDatabase();
    
    // If no specific user is requested, get the current authenticated user
    if (!requestedUserId && !requestedUsername) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      const probability = await getUserWinProbability(clerkUser.id);
      
      // Check if no user found
      if (probability === 0) {
        // If probability is 0, we still return success but with emptyData flag
        return NextResponse.json({ 
          userId: clerkUser.id,
          username: clerkUser.username,
          probability,
          emptyData: true
        });
      }
      
      return NextResponse.json({ 
        userId: clerkUser.id,
        username: clerkUser.username,
        probability 
      });
    }
    
    // Otherwise look up the requested user
    // For now, we'll only implement lookup by userId for simplicity
    if (requestedUserId) {
      const probability = await getUserWinProbability(requestedUserId);
      
      return NextResponse.json({ 
        userId: requestedUserId,
        probability 
      });
    }
    
    // If we get here, the request was malformed
    return NextResponse.json({ 
      error: "Invalid request. Please provide a userId or authenticate." 
    }, { status: 400 });
    
  } catch (error: any) {
    console.error("Error retrieving win probability:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}