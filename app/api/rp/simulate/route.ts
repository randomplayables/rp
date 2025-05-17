// app/api/rp/simulate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { simulatePayouts } from "@/lib/payablesEngine";
import { currentUser } from "@clerk/nextjs/server";

/**
 * POST endpoint to simulate payouts
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check - only authenticated users can run simulations
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { amount } = await request.json();
    
    // Validate amount
    if (!amount || amount < 1 || amount > 10000) {
      return NextResponse.json({ 
        error: "Invalid amount. Please provide a value between 1 and 10000." 
      }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Run the simulation
    const results = await simulatePayouts(amount);
    
    return NextResponse.json({ 
      success: true,
      simulationAmount: amount,
      results 
    });
  } catch (error: any) {
    console.error("Error running payout simulation:", error);
    return NextResponse.json({ 
      error: "Internal Error", 
      details: error.message 
    }, { status: 500 });
  }
}