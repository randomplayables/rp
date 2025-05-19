import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { executePayout } from "@/lib/payablesEngine";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";

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
    
    // Check if user is admin
    if (!isAdmin(clerkUser.id, clerkUser.username)) {
      return NextResponse.json({ 
        error: "Forbidden: Admin access required" 
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