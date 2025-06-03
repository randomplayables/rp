import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MODELS,
  getAvailableModelsForUser,
  getCodeReviewPeer,
  isModelFree, 
  ModelDefinition, // Make sure ModelDefinition is exported from modelConfig.ts
} from "./modelConfig";

// Helper function to get monthly limit based on tier
function getMonthlyLimitForTier(tier?: string | null): number {
  switch (tier) {
    case "premium":
      return 500;
    case "premium_plus":
      return 1500;
    default:
      return 100; // Basic/free tier
  }
}

async function getUserSubscriptionAndUsage(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { subscriptionActive: true, subscriptionTier: true },
  });
  const isSubscribed = profile?.subscriptionActive || false;
  const subscriptionTier = profile?.subscriptionTier;

  const usageRecord = await prisma.apiUsage.findUnique({
    where: { userId },
  });

  const monthlyLimit = getMonthlyLimitForTier(subscriptionTier);
  let currentUsageCount = usageRecord?.usageCount || 0;

  let needsReset = false;
  if (usageRecord) {
    const now = new Date();
    const lastReset = new Date(usageRecord.lastResetDate);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      needsReset = true;
    }
  } else {
    needsReset = true;
  }

  const finalUsageCountForCanUseApi = needsReset ? 0 : currentUsageCount;
  const remainingRequests = Math.max(0, monthlyLimit - finalUsageCountForCanUseApi);
  const canUseApi = remainingRequests > 0;

  return { 
    isSubscribed, 
    canUseApi, 
    remainingRequests, 
    monthlyLimit, 
    needsReset, 
    currentUsageCountBeforeReset: currentUsageCount 
  };
}

export interface ResolvedModelsResult {
  chatbot1Model: string;
  chatbot2Model?: string;
  canUseApi: boolean;
  remainingRequests?: number;
  limitReached?: boolean;
  error?: string;
}

export async function resolveModelsForChat(
  userId: string,
  isUserSubscribed: boolean,
  useCodeReview: boolean,
  selectedCoderModelId?: string | null,
  selectedReviewerModelId?: string | null
): Promise<ResolvedModelsResult> {
  // Corrected destructuring and error handling
  const usageDetails = await getUserSubscriptionAndUsage(userId);

  if (!usageDetails.canUseApi) {
    return {
      chatbot1Model: "", 
      canUseApi: false,
      remainingRequests: 0, 
      limitReached: true,   
      error: "Monthly API request limit reached. Please upgrade your plan or wait for the next cycle.",
    };
  }

  let chatbot1Model: string;
  let chatbot2Model: string | undefined;

  const availableToUser = getAvailableModelsForUser(isUserSubscribed);

  const validateModel = (selectedId: string | null | undefined): string | null => {
    if (!selectedId) return null;
    const isModelAllowed = availableToUser.some(m => m.id === selectedId);
    if (!isModelAllowed) {
      console.warn(`User ${userId} selected unauthorized model '${selectedId}'. It will be ignored.`);
      return null;
    }
    return selectedId;
  };

  if (useCodeReview) {
    const validCoderModel = validateModel(selectedCoderModelId);
    const validReviewerModel = validateModel(selectedReviewerModelId);

    if (validCoderModel && validReviewerModel) {
      chatbot1Model = validCoderModel;
      chatbot2Model = validReviewerModel;
    } else if (validCoderModel) {
      chatbot1Model = validCoderModel;
      chatbot2Model = getCodeReviewPeer(validCoderModel, isUserSubscribed);
    } else if (validReviewerModel) {
      chatbot2Model = validReviewerModel;
      chatbot1Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot1 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1;
    } else {
      chatbot1Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot1 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1;
      chatbot2Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot2 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot2;
    }
  } else {
    const validCoderModel = validateModel(selectedCoderModelId);
    if (validCoderModel) {
      chatbot1Model = validCoderModel;
    } else {
      chatbot1Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.noCodeReview : DEFAULT_MODELS.nonSubscribed.noCodeReview;
    }
  }
  return { 
    chatbot1Model, 
    chatbot2Model, 
    canUseApi: true, // Changed from usageDetails.canUseApi as we already checked it
    remainingRequests: usageDetails.remainingRequests 
  };
}

export interface IncrementApiUsageParams {
  userId: string;
  isSubscribed: boolean;
  useCodeReview: boolean;
  coderModelId?: string | null;
  reviewerModelId?: string | null;
}

export async function incrementApiUsage(params: IncrementApiUsageParams): Promise<void> {
  const { userId, isSubscribed, useCodeReview, coderModelId, reviewerModelId } = params;

  let requestsToCharge = 0;

  if (!isSubscribed) {
    requestsToCharge = 1;
  } else {
    if (!useCodeReview) {
      if (coderModelId && !isModelFree(coderModelId)) {
        requestsToCharge = 1;
      } else {
        requestsToCharge = 0;
      }
    } else {
      if (coderModelId && !isModelFree(coderModelId)) {
        requestsToCharge += 2; 
      }
      if (reviewerModelId && !isModelFree(reviewerModelId)) {
        requestsToCharge += 1; 
      }
    }
  }

  if (requestsToCharge === 0) {
    return;
  }

  try {
    const now = new Date();
    let usage = await prisma.apiUsage.findUnique({ where: { userId } });

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { subscriptionTier: true }
    });
    const currentMonthlyLimit = getMonthlyLimitForTier(profile?.subscriptionTier);

    if (!usage) {
      await prisma.apiUsage.create({
        data: {
          userId,
          usageCount: requestsToCharge,
          monthlyLimit: currentMonthlyLimit,
          lastResetDate: now
        }
      });
    } else {
      const lastReset = new Date(usage.lastResetDate);
      let newUsageCount = usage.usageCount + requestsToCharge;
      let newLastResetDate = usage.lastResetDate;

      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        newUsageCount = requestsToCharge; 
        newLastResetDate = now;
      }
      
      await prisma.apiUsage.update({
        where: { userId },
        data: {
          usageCount: newUsageCount,
          monthlyLimit: currentMonthlyLimit, 
          lastResetDate: newLastResetDate
        }
      });
    }
  } catch (error) {
    console.error(`Error incrementing API usage for user ${userId}:`, error);
  }
}