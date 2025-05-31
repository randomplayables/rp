import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { fetchRelevantData, DATA_TYPES } from "../chat/datalabHelper"; // Assuming fetchRelevantData and DATA_TYPES are refactored/exported

export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    // Optional: Check if user is authenticated if context data should be user-specific
    // if (!clerkUser) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }
    // For DataLab, general context might not need strict auth for this specific endpoint,
    // or it could return a more generic schema if not authenticated.

    const userId = clerkUser?.id || null;

    // Fetch a representative data context by selecting all available data types
    // and using a generic query string that implies a general request.
    const allDataTypes = Object.values(DATA_TYPES);
    const genericQuery = "Provide a general overview of available data structures.";
    
    const generalDataContext = await fetchRelevantData(genericQuery, userId, allDataTypes);

    // We are interested in the keys of the general data context to inform the user.
    const contextKeys = Object.keys(generalDataContext);
    
    const sandboxFetchError = generalDataContext.sandboxFetchError; // Pass along any error during sandbox data fetching

    return NextResponse.json({
      availableDataCategories: allDataTypes,
      generalContextKeys: contextKeys,
      ...(sandboxFetchError && { sandboxFetchErrorNote: `Note: During context generation, an issue was encountered: ${sandboxFetchError}` })
    });

  } catch (error: any) {
    console.error("Error fetching datalab context-data:", error);
    return NextResponse.json(
      { error: "Failed to fetch DataLab context data", details: error.message },
      { status: 500 }
    );
  }
}