import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import SurveyModel from "@/models/Survey";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await context.params;
    const uniqueId = id;

    // Find survey by the unique ID in the shareable link
    const survey = await SurveyModel.findOne({
      shareableLink: { $regex: uniqueId }
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    return NextResponse.json({ survey });
  } catch (error: any) {
    console.error("Error fetching survey:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
