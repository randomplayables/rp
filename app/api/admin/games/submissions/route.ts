import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSubmissionModel from "@/models/GameSubmission";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        await connectToDatabase();

        const query: any = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            query.status = status;
        }

        const submissions = await GameSubmissionModel.find(query).sort({ submittedAt: -1 }).lean();

        return NextResponse.json({ submissions });

    } catch (error: any) {
        console.error("Error fetching game submissions:", error);
        return NextResponse.json({ 
            error: "Failed to fetch game submissions", 
            details: error.message 
        }, { status: 500 });
    }
}