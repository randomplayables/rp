import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

interface ModelSelectionResult {
  model: string;
  canUseApi: boolean;
  remainingRequests?: number;
}

// Helper function to get monthly limit based on tier
function getMonthlyLimitForTier(tier?: string | null): number {
  switch (tier) {
    case "premium":
      return 500;
    case "premium_plus":
      return 1500;
    default:
      return 100; // Basic tier gets 100 requests
  }
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
        model = "openai/o4-mini-high"
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
    const now = new Date();
    
    // Get or create usage record
    let usage = await prisma.apiUsage.findUnique({
      where: { userId }
    });

    if (!usage) {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { subscriptionTier: true }
      });

      const monthlyLimit = getMonthlyLimitForTier(profile?.subscriptionTier);
      
      usage = await prisma.apiUsage.create({
        data: {
          userId,
          usageCount: 1,
          monthlyLimit,
          lastResetDate: now
        }
      });
      return true;
    }

    // Check if we need to reset monthly usage
    const lastReset = new Date(usage.lastResetDate);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      // Reset monthly usage
      await prisma.apiUsage.update({
        where: { userId },
        data: {
          usageCount: 1,
          lastResetDate: now
        }
      });
      return true;
    } else {
      // Check if user has remaining requests
      if (usage.usageCount >= usage.monthlyLimit) {
        return false; // No more requests available
      }
      
      // Increment usage count
      await prisma.apiUsage.update({
        where: { userId },
        data: {
          usageCount: { increment: 1 }
        }
      });
      
      return true;
    }
  } catch (error) {
    console.error("Error incrementing API usage:", error);
    return false;
  }
}