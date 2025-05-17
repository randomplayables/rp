// app/api/rp/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { executePayout } from "@/lib/payablesEngine";
import { currentUser } from "@clerk/nextjs/server";

/**
 * POST endpoint to execute a real payout
 * This would typically be restricted to admin users
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // TODO: Check for admin role - this is simplified for the example
    // In a real application, you'd check if the user has admin permissions
    const isAdmin = true; // Replace with actual admin check
    
    if (!isAdmin) {
      return NextResponse.json({ 
        error: "Insufficient permissions. Only admins can execute payouts." 
      }, { status: 403 });
    }
    
    const { amount } = await request.json();
    
    // Validate amount
    if (!amount || amount < 1 || amount > 10000) {
      return NextResponse.json({ 
        error: "Invalid amount. Please provide a value between 1 and 10000." 
      }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Execute the payout
    const batchId = await executePayout(amount);
    
    return NextResponse.json({ 
      success: true,
      payoutAmount: amount,
      batchId 
    });
  } catch (error: any) {
    console.error("Error executing payout:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}