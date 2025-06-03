import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MODELS,
  getAvailableModelsForUser,
  getCodeReviewPeer,
  ModelDefinition,
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
  const currentUsageCount = usageRecord?.usageCount || 0;

  let needsReset = false;
  if (usageRecord) {
    const now = new Date();
    const lastReset = new Date(usageRecord.lastResetDate);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      needsReset = true;
    }
  }

  const finalUsageCountForCanUseApi = needsReset ? 0 : currentUsageCount;
  const remainingRequests = Math.max(0, monthlyLimit - finalUsageCountForCanUseApi);
  const canUseApi = remainingRequests > 0;

  return { isSubscribed, canUseApi, remainingRequests, monthlyLimit, needsReset, currentUsageCountBeforeReset: currentUsageCount };
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
  selectedCoderModelId?: string | null, // For chatbot1
  selectedReviewerModelId?: string | null // For chatbot2 if useCodeReview is true
): Promise<ResolvedModelsResult> {
  const { canUseApi, remainingRequests } = await getUserSubscriptionAndUsage(userId);

  if (!canUseApi) {
    return {
      chatbot1Model: "",
      canUseApi: false,
      remainingRequests: 0,
      limitReached: true,
      error: "Monthly API request limit reached. Please upgrade your plan.",
    };
  }

  let chatbot1Model: string;
  let chatbot2Model: string | undefined;

  const availableToUser = getAvailableModelsForUser(isUserSubscribed);

  // Helper to validate a selected model
  const validateModel = (selectedId: string | null | undefined): string | null => {
    if (!selectedId) return null;
    const isModelAllowed = availableToUser.some(m => m.id === selectedId);
    if (!isModelAllowed) {
      console.warn(`User ${userId} selected unauthorized model '${selectedId}'. It will be ignored.`);
      return null; // Invalid selection, treat as not selected
    }
    return selectedId; // Valid
  };

  if (useCodeReview) {
    const validCoderModel = validateModel(selectedCoderModelId);
    const validReviewerModel = validateModel(selectedReviewerModelId);

    if (validCoderModel && validReviewerModel) {
      chatbot1Model = validCoderModel;
      chatbot2Model = validReviewerModel;
    } else if (validCoderModel) { // Only coder model is selected and valid
      chatbot1Model = validCoderModel;
      chatbot2Model = getCodeReviewPeer(validCoderModel, isUserSubscribed);
    } else if (validReviewerModel) { // Only reviewer model is selected and valid (less common UI path)
      // If only reviewer is picked, we might need a "getPeerForReviewer" or use default coder
      chatbot2Model = validReviewerModel;
      chatbot1Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot1 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1;
      // Or, pick a peer for the coder based on the reviewer (more complex)
      // For simplicity, if reviewer is picked but coder isn't, we could use the default coder.
    } else { // Neither (or invalid) models selected, use defaults
      chatbot1Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot1 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1;
      chatbot2Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot2 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot2;
    }
  } else { // Not using code review
    const validCoderModel = validateModel(selectedCoderModelId);
    if (validCoderModel) {
      chatbot1Model = validCoderModel;
    } else {
      chatbot1Model = isUserSubscribed ? DEFAULT_MODELS.subscribed.noCodeReview : DEFAULT_MODELS.nonSubscribed.noCodeReview;
    }
  }
  return { chatbot1Model, chatbot2Model, canUseApi, remainingRequests };
}

export async function incrementApiUsage(userId: string): Promise<void> {
  try {
    const now = new Date();
    let usage = await prisma.apiUsage.findUnique({ where: { userId } });

    if (!usage) {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { subscriptionTier: true }
      });
      const monthlyLimit = getMonthlyLimitForTier(profile?.subscriptionTier);
      await prisma.apiUsage.create({
        data: { userId, usageCount: 1, monthlyLimit, lastResetDate: now }
      });
    } else {
      const lastReset = new Date(usage.lastResetDate);
      let newUsageCount = usage.usageCount + 1;
      let newLastResetDate = usage.lastResetDate;

      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        newUsageCount = 1; 
        newLastResetDate = now;
      }
      
      if (newUsageCount > usage.monthlyLimit && !(now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear())) {
         console.warn(`API usage increment for ${userId} would exceed limit (${newUsageCount}/${usage.monthlyLimit}). Clamping. Ensure canUseApi was checked.`);
         newUsageCount = usage.monthlyLimit;
      }

      await prisma.apiUsage.update({
        where: { userId },
        data: {
          usageCount: newUsageCount,
          lastResetDate: newLastResetDate
        }
      });
    }
  } catch (error) {
    console.error("Error incrementing API usage for user:", userId, error);
  }
}