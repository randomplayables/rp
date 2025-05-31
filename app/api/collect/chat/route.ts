import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { currentUser } from "@clerk/nextjs/server";
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";

// This is the default template if the frontend sends an empty customSystemPrompt
// It also uses the %%AVAILABLE_GAMES_LIST%% placeholder.
const FALLBACK_SYSTEM_PROMPT_TEMPLATE = `
You are an AI assistant specialized in creating custom surveys for the RandomPlayables platform.
You help users design effective surveys, questionnaires, and data collection tools that can
optionally incorporate interactive games.

Available games that can be integrated into surveys:
%%AVAILABLE_GAMES_LIST%%

When helping design surveys:
1. Ask clarifying questions about the user's research goals and target audience
2. Suggest appropriate question types (multiple choice, Likert scale, open-ended, etc.)
3. Help write clear, unbiased questions
4. Recommend game integration where appropriate for engagement or data collection
5. Advise on survey flow and organization

When designing a survey with game integration:
1. Explain how the game data will complement traditional survey questions
2. Discuss how to interpret combined qualitative and quantitative results
3. Suggest appropriate placement of games within the survey flow

Return your suggestions in a clear, structured format. If suggesting multiple questions,
number them and specify the question type for each.
`;

// Reusable function to fetch game data (Type A)
async function fetchActiveGamesList() {
  await connectToDatabase();
  const games = await GameModel.find({}, {
    id: 1, name: 1, description: 1, _id: 0
  }).limit(10).lean();
  return games;
}

const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // customSystemPrompt is now editedSystemPromptWithPlaceholders from frontend
    const { message, chatHistory, customSystemPrompt } = await request.json();
    
    const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id);
    
    if (!canUseApi) {
      return NextResponse.json({ 
        error: "Monthly API request limit reached. Please upgrade your plan for more requests.", 
        limitReached: true 
      }, { status: 403 });
    }
    
    let finalSystemPrompt: string;

    if (customSystemPrompt && customSystemPrompt.trim() !== "") {
      // Use the prompt from the frontend.
      // For Collect tool, Type A data (games list) is already injected by the frontend.
      // If there were Type B placeholders to be resolved by the backend, it would happen here.
      // Example: finalSystemPrompt = customSystemPrompt.replace('%%QUERY_SPECIFIC_DATA%%', fetchedQuerySpecificData);
      finalSystemPrompt = customSystemPrompt;
      
      // Sanity check: if the frontend somehow failed to inject games, inject them now.
      // This is a fallback and ideally shouldn't be needed if frontend works correctly.
      if (finalSystemPrompt.includes("%%AVAILABLE_GAMES_LIST%%")) {
        console.warn("Collect Chat API: Frontend-provided system prompt still contains %%AVAILABLE_GAMES_LIST%%. Resolving now.");
        const games = await fetchActiveGamesList();
        const gamesListString = JSON.stringify(games, null, 2);
        finalSystemPrompt = finalSystemPrompt.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
      }

    } else {
      // Frontend sent no custom prompt (e.g., user cleared it), so backend builds the default.
      console.log("Collect Chat API: No customSystemPrompt from frontend, using fallback template.");
      const games = await fetchActiveGamesList(); // Fetch Type A data
      const gamesListString = JSON.stringify(games, null, 2);
      finalSystemPrompt = FALLBACK_SYSTEM_PROMPT_TEMPLATE.replace("%%AVAILABLE_GAMES_LIST%%", gamesListString);
    }
    
    const messagesToAI = [
      { role: "system", content: finalSystemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: message }
    ];
    
    const response = await openAI.chat.completions.create({
      model: model,
      messages: messagesToAI as any, // Cast to 'any' if OpenAI types conflict, ensure structure is correct
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    await incrementApiUsage(clerkUser.id);
    
    return NextResponse.json({
      message: response.choices[0].message.content,
      remainingRequests
    });

  } catch (error: any) {
    console.error("Error in Collect chat:", error);
    return NextResponse.json(
      { error: "Failed to generate survey suggestion", details: error.message },
      { status: 500 }
    );
  }
}