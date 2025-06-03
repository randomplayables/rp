export interface ModelDefinition {
    id: string; // e.g., "meta-llama/llama-3.3-8b-instruct:free"
    name: string; // e.g., "Llama 3.3 8B Instruct (Free)"
    tier: 'free' | 'premium';
    provider: 'meta' | 'deepseek' | 'openai' | 'google';
  }
  
  export const FREE_MODELS: ModelDefinition[] = [
    { id: "meta-llama/llama-3.3-8b-instruct:free", name: "Meta Llama 3.3 8B Instruct (Free)", tier: "free", provider: "meta" },
    { id: "deepseek/deepseek-r1-0528:free", name: "Deepseek Coder R1 0528 (Free)", tier: "free", provider: "deepseek" },
  ];
  
  export const PREMIUM_MODELS_SUBSCRIBED: ModelDefinition[] = [
    { id: "openai/o4-mini-high", name: "OpenAI GPT-4o Mini High", tier: "premium", provider: "openai" },
    { id: "google/gemini-2.5-flash-preview-05-20", name: "Google Gemini 2.5 Flash Preview", tier: "premium", provider: "google" },
    // Subscribed users can also use free models, so they are added here.
    // If you want subscribed users to ONLY see premium models in their selection (unless they pick "free" tier explicitly),
    // then do not spread FREE_MODELS here and adjust getAvailableModels logic.
    // For now, following citation [cite: 10] which lists free models for subscribed users.
    ...FREE_MODELS,
  ];
  
  // Default model selections [cite: 12]
  export const DEFAULT_MODELS = {
    nonSubscribed: {
      noCodeReview: "meta-llama/llama-3.3-8b-instruct:free",
      codeReview: {
        chatbot1: "meta-llama/llama-3.3-8b-instruct:free",
        chatbot2: "deepseek/deepseek-r1-0528:free",
      },
    },
    subscribed: {
      noCodeReview: "openai/o4-mini-high",
      codeReview: {
        chatbot1: "openai/o4-mini-high",
        chatbot2: "google/gemini-2.5-flash-preview-05-20",
      },
    },
  };
  
  // Helper to get model list for a user based on subscription status for UI population [cite: 9, 10]
  export function getAvailableModelsForUser(isSubscribed: boolean): ModelDefinition[] {
    if (isSubscribed) {
      return PREMIUM_MODELS_SUBSCRIBED;
    }
    return FREE_MODELS;
  }
  
  // Helper to determine the peer model for code review if one is selected by the user
  export function getCodeReviewPeer(selectedModelId: string, isSubscribed: boolean): string {
    const allModelsForUser = getAvailableModelsForUser(isSubscribed);
    const selectedModel = allModelsForUser.find(m => m.id === selectedModelId);
  
    if (!selectedModel) {
      // Fallback if the selected model isn't in the expected list (shouldn't happen with proper UI)
      return isSubscribed ? DEFAULT_MODELS.subscribed.codeReview.chatbot2 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot2;
    }
  
    // Try to find a different model of the same tier first
    const potentialPeersSameTier = allModelsForUser.filter(m => m.id !== selectedModelId && m.tier === selectedModel.tier);
    if (potentialPeersSameTier.length > 0) {
      return potentialPeersSameTier[0].id;
    }
  
    // If subscribed and selected a premium model but no other premium model is available (unlikely with current lists)
    // or if selected a free model (as a subscribed user), try to find another free model.
    if (selectedModel.tier === 'premium' || isSubscribed) {
      const freePeers = FREE_MODELS.filter(m => m.id !== selectedModelId);
      if (freePeers.length > 0) {
        return freePeers[0].id;
      }
    }
  
    // Fallback to default reviewer models
    if (isSubscribed) {
      return selectedModelId === DEFAULT_MODELS.subscribed.codeReview.chatbot1 ? DEFAULT_MODELS.subscribed.codeReview.chatbot2 : DEFAULT_MODELS.subscribed.codeReview.chatbot1;
    } else { // Not subscribed
      return selectedModelId === DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1 ? DEFAULT_MODELS.nonSubscribed.codeReview.chatbot2 : DEFAULT_MODELS.nonSubscribed.codeReview.chatbot1;
    }
  }