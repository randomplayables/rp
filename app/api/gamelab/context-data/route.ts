import { NextResponse } from "next/server";
import { getTemplateStructure, fetchGeneralGameLabContext } from "../chat/gamelabHelper"; // Import from helper

export async function GET() {
  try {
    const templateStructure = getTemplateStructure();
    // const generalContext = await fetchGeneralGameLabContext(); // If you add more Type A data

    return NextResponse.json({ 
        templateStructure,
        // ...generalContext 
    });
  } catch (error: any) {
    console.error("Error fetching gamelab context-data:", error);
    return NextResponse.json(
      { error: "Failed to fetch GameLab context data", details: error.message },
      { status: 500 }
    );
  }
}