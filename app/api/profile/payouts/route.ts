import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PayoutRecordModel } from "@/models/RandomPayables";

export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const payouts = await PayoutRecordModel.find({ userId: clerkUser.id, status: 'completed' })
      .sort({ timestamp: -1 })
      .lean();

    return NextResponse.json({ payouts });
  } catch (error: any) {
    console.error("Error fetching user payouts:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}