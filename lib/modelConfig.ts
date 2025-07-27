export interface ModelDefinition {
  id: string; // e.g., "meta-llama/llama-3.3-8b-instruct:free"
  name: string; // e.g., "Llama 3.3 8B Instruct (Free)"
  tier: 'free' | 'premium';
  provider: 'meta' | 'deepseek' | 'openai' | 'google' | 'qwen';
}

export const FREE_MODELS: ModelDefinition[] = [
  { id: "qwen/qwen3-coder:free", name: "Qwen: Qwen3 Coder (free)", tier: "free", provider: "qwen" },
  { id: "deepseek/deepseek-r1-0528:free", name: "Deepseek Coder R1 0528 (Free)", tier: "free", provider: "deepseek" },
];

export const PREMIUM_MODELS_SUBSCRIBED: ModelDefinition[] = [
  { id: "openai/o4-mini-high", name: "OpenAI GPT-4o Mini High", tier: "premium", provider: "openai" },
  { id: "google/gemini-2.5-flash", name: "Google Gemini 2.5 Flash", tier: "premium", provider: "google" },
  // Subscribed users can also use free models
  ...FREE_MODELS,
];

// Default model selections
export const DEFAULT_MODELS = {
  nonSubscribed: {
    noCodeReview: "deepseek/deepseek-r1-0528:free",
    codeReview: {
      chatbot1: "deepseek/deepseek-r1-0528:free",
      chatbot2: "qwen/qwen3-coder:free",
    },
  },
  subscribed: {
    noCodeReview: "openai/o4-mini-high",
    codeReview: {
      chatbot1: "openai/o4-mini-high",
      chatbot2: "google/gemini-2.5-flash",
    },
  },
};

// Helper to get model list for a user based on subscription status for UI population
export function getAvailableModelsForUser(isSubscribed: boolean): ModelDefinition[] {
  if (isSubscribed) {
    // Return a unique list of models, prioritizing premium if duplicates exist by ID
    const allSubscribedModels = [...PREMIUM_MODELS_SUBSCRIBED];
    const uniqueModelIds = new Set<string>();
    return allSubscribedModels.filter(model => {
      if (!uniqueModelIds.has(model.id)) {
        uniqueModelIds.add(model.id);
        return true;
      }
      return false;
    });
  }
  return FREE_MODELS;
}

// Helper to determine the peer model for code review if one is selected by the user
export function getCodeReviewPeer(selectedModelId: string, isSubscribed: boolean): string {
  const allModelsForUser = getAvailableModelsForUser(isSubscribed);
  const selectedModel = allModelsForUser.find(m => m.id === selectedModelId);

  if (!selectedModel) {
    return isSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot2 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot2;
  }

  const potentialPeersSameTier = allModelsForUser.filter(m => m.id !== selectedModelId && m.tier === selectedModel.tier);
  if (potentialPeersSameTier.length > 0) {
    return potentialPeersSameTier[0].id;
  }

  if (selectedModel.tier === 'premium' || isSubscribed) {
    const freePeers = FREE_MODELS.filter(m => m.id !== selectedModelId);
    if (freePeers.length > 0) {
      return freePeers[0].id;
    }
  }

  if (isSubscribed) {
    return selectedModelId === DEFAULT_MODELS.subscribed.codeReview.chatbot1 ? DEFAULT_MODELS.subscribed.codeReview.chatbot2 : DEFAULT_MODELS.subscribed.codeReview.chatbot1;
  } else { 
    return selectedModelId === DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1 ? DEFAULT_MODELS.nonSubscribed.codeReview.chatbot2 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1;
  }
}

/**
* Checks if a given model ID is considered free.
* @param modelId The ID of the model to check.
* @returns True if the model is free, false otherwise.
*/
export function isModelFree(modelId: string | null | undefined): boolean {
if (!modelId) {
  return true; // Assuming a missing model ID means no charge for that step
}
// Create a unique list of all models to check against.
const premiumIds = new Set(PREMIUM_MODELS_SUBSCRIBED.map(m => m.id));
const allModels: ModelDefinition[] = [
    ...PREMIUM_MODELS_SUBSCRIBED, // Includes FREE_MODELS already if PREMIUM_MODELS_SUBSCRIBED is defined as shown
    ...FREE_MODELS.filter(fm => !premiumIds.has(fm.id)) // Add any FREE_MODELS not already included
];

// Ensure PREMIUM_MODELS_SUBSCRIBED itself is unique if FREE_MODELS were spread into it
const uniqueAllModels = Array.from(new Set(allModels.map(m => m.id))).map(id => allModels.find(m => m.id === id)!);

const model = uniqueAllModels.find(m => m.id === modelId);
return model?.tier === 'free';
}