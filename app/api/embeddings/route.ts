import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { callOpenAIEmbeddings } from "@/lib/aiService";
import { isModelFree } from "@/lib/modelConfig";
import { incrementApiUsage, IncrementApiUsageParams } from "@/lib/modelSelection";
import { prisma } from "@/lib/prisma";

// A simple model resolver for embeddings. Could be expanded later.
const getEmbeddingModelForUser = (isSubscribed: boolean): string => {
  // This function can be expanded to use different models based on subscription.
  // For now, we use the model from the original emojiphone game for consistency.
  // OpenRouter can proxy this OpenAI model.
  return "text-embedding-ada-002";
};

// Helper function to get monthly limit based on tier
function getMonthlyLimitForTier(tier?: string | null): number {
  switch (tier) {
    case "premium": return 500;
    case "premium_plus": return 1500;
    default: return 100;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Subscription & Usage Check ---
    const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { subscriptionActive: true, subscriptionTier: true }
    });
    
    const usageRecord = await prisma.apiUsage.findUnique({
        where: { userId: user.id }
    });

    const monthlyLimit = getMonthlyLimitForTier(profile?.subscriptionTier);
    let currentUsage = usageRecord?.usageCount || 0;
    
    // Check for monthly reset
    if (usageRecord) {
        const now = new Date();
        const lastReset = new Date(usageRecord.lastResetDate);
        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
            currentUsage = 0; // Reset for the check, will be saved upon usage increment.
        }
    }

    if (currentUsage >= monthlyLimit) {
      return NextResponse.json({ error: "Monthly API request limit reached." }, { status: 403 });
    }
    // --- End Usage Check ---

    const { words } = await request.json();
    if (!words || !Array.isArray(words) || words.length === 0 || words.some(w => typeof w !== 'string')) {
      return NextResponse.json({ error: "A non-empty array of strings is required in the 'words' field." }, { status: 400 });
    }

    // OpenAI's embedding endpoint has a limit on the number of input strings.
    if (words.length > 2048) {
      return NextResponse.json({ error: `Too many words. The maximum is 2048, but ${words.length} were provided.`}, { status: 400 });
    }
    
    const isSubscribed = profile?.subscriptionActive || false;
    const modelId = getEmbeddingModelForUser(isSubscribed);
    
    const response = await callOpenAIEmbeddings(modelId, words);
    
    const embeddings: Record<string, number[]> = {};
    response.data.forEach((item, idx) => {
      embeddings[words[idx]] = item.embedding;
    });

    // Increment usage. One embedding call is treated as one request.
    // For subscribed users, calls to free models do not count.
    if (!isSubscribed || !isModelFree(modelId)) {
        const incrementParams: IncrementApiUsageParams = {
            userId: user.id,
            isSubscribed: isSubscribed,
            useCodeReview: false,
            coderModelId: modelId
        };
        await incrementApiUsage(incrementParams);
    }

    return NextResponse.json({ embeddings });

  } catch (error: any) {
    console.error("[API/EMBEDDINGS] Error:", error);
    return NextResponse.json({ error: "Failed to fetch embeddings", details: error.message }, { status: 500 });
  }
}