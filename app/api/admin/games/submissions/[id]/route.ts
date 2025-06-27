import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import GameSubmissionModel from "@/models/GameSubmission";
import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser || !isAdmin(clerkUser.id, clerkUser.username)) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const { status } = await request.json();
        const submissionId = params.id;

        if (!submissionId || !status || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: "Invalid submission ID or status provided." }, { status: 400 });
        }

        await connectToDatabase();

        // Update the status for both 'approved' and 'rejected'
        const updatedSubmission = await GameSubmissionModel.findByIdAndUpdate(
            submissionId,
            { $set: { status: status } },
            { new: true }
        );

        if (!updatedSubmission) {
            return NextResponse.json({ error: "Submission not found." }, { status: 404 });
        }

        console.log(`Submission ${submissionId} status updated to ${status}.`);
        return NextResponse.json({ success: true, submission: updatedSubmission });
        
    } catch (error: any) {
        console.error(`Error updating submission ${params.id}:`, error);
        return NextResponse.json({
            error: "Failed to update submission status",
            details: error.message
        }, { status: 500 });
    }
}