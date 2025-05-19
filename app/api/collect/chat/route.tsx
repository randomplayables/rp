import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/lib/mongodb";
import GameModel from "@/models/Game";
import { currentUser } from "@clerk/nextjs/server";
import { getModelForUser, incrementApiUsage } from "@/lib/modelSelection";

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

    const { message, chatHistory, systemPrompt: customSystemPrompt } = await request.json();
    
    // Check subscription and get appropriate model
    const { model, canUseApi, remainingRequests } = await getModelForUser(clerkUser.id);
    
    if (!canUseApi) {
      return NextResponse.json({ 
        error: "Monthly API request limit reached. Please upgrade your plan for more requests.", 
        limitReached: true 
      }, { status: 403 });
    }
    
    // Fetch available games to offer as options
    await connectToDatabase();
    const games = await GameModel.find({}, {
      id: 1, name: 1, description: 1, _id: 0
    }).limit(10).lean();
    
    // Use the custom system prompt if provided, otherwise use the default
    const systemPrompt = customSystemPrompt || `
    You are an AI assistant specialized in creating custom surveys for the RandomPlayables platform.
    You help users design effective surveys, questionnaires, and data collection tools that can
    optionally incorporate interactive games.

    Available games that can be integrated into surveys:
    ${JSON.stringify(games, null, 2)}

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
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: message }
    ];
    
    const response = await openAI.chat.completions.create({
      model: model,
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    // Increment API usage counter
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