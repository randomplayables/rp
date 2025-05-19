import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

interface ModelSelectionResult {
  model: string;
  canUseApi: boolean;
  remainingRequests?: number;
}

export async function getModelForUser(userId?: string): Promise<ModelSelectionResult> {
  try {
    if (!userId) {
      const user = await currentUser();
      userId = user?.id;
    }

    if (!userId) {
      return {
        model: "meta-llama/llama-3.2-3b-instruct:free",
        canUseApi: true
      };
    }

    // Get user profile to check subscription
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });

    // Get usage data
    const usage = await prisma.apiUsage.findUnique({
      where: { userId }
    });

    let model = "meta-llama/llama-3.2-3b-instruct:free";
    let canUseApi = true;
    let remainingRequests = 0;

    // If user has an active subscription, allow stronger model
    if (profile?.subscriptionActive && profile.subscriptionTier) {
      // For premium tiers, use a stronger model
      if (profile.subscriptionTier === "premium" || profile.subscriptionTier === "premium_plus") {
        model = "anthropic.claude-3-5-sonnet-20240620"; // Example stronger model
      }
      
      // Check usage limits
      if (usage) {
        remainingRequests = Math.max(0, usage.monthlyLimit - usage.usageCount);
        canUseApi = remainingRequests > 0;
      }
    }

    return {
      model,
      canUseApi,
      remainingRequests
    };
  } catch (error) {
    console.error("Error getting model for user:", error);
    // Default to free model if there's an error
    return {
      model: "meta-llama/llama-3.2-3b-instruct:free",
      canUseApi: true
    };
  }
}

export async function incrementApiUsage(userId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/usage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      }
    });
    
    const data = await response.json();
    return data.remaining > 0;
  } catch (error) {
    console.error("Error incrementing API usage:", error);
    return false;
  }
}