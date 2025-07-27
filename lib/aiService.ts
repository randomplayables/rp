import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

// Client for OpenRouter (for chat completions)
const openRouterAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://randomplayables.com",
    "X-Title": "randomplayables",
  },
});

// NEW: Client specifically for native OpenAI API (for embeddings)
const nativeOpenAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Assumes you have OPENAI_API_KEY in your .env.local
});


/**
 * Calls the OpenAI-compatible chat API (OpenRouter).
 * @param modelName The name of the model to use.
 * @param messages The array of messages for the chat.
 * @param customMaxTokens Optional custom max tokens for the response.
 * @returns The API response.
 */
export async function callOpenAIChat(
  modelName: string,
  messages: ChatCompletionMessageParam[],
  customMaxTokens?: number
) {
  // Determine max_tokens, o4-mini models generally support larger context/responses
  // const max_tokens = customMaxTokens ?? (modelName.includes('o4-mini') ? 4000 : 2000);

  // Format messages for API compatibility (especially for text-only vs. multimodal models)
  const messagesForApi = messages.map(msg => {
    if (msg.role === "system" || msg.role === "assistant") {
        return msg; // System and assistant messages usually have string content
    }
    // For user messages, ensure content is in the correct format
    if (typeof msg.content === 'string') {
        // Models like Llama and Deepseek prefer simple string content for user role
        if (modelName.startsWith("meta-llama/") || modelName.startsWith("deepseek/") || modelName.startsWith("qwen/")) {
            return { role: msg.role, content: msg.content };
        }
        // Other models, especially multimodal ones, expect content as an array of parts
        return { role: msg.role, content: [{ type: "text", text: msg.content }] };
    }
    // If content is already an array (e.g., for multimodal), pass it as is
    return msg;
  });

  // This function continues to use the OpenRouter client
  return openRouterAI.chat.completions.create({
    model: modelName,
    messages: messagesForApi as any, // Cast to any if OpenAI types cause issues with specific structures
    temperature: 0.7,
    // max_tokens has been removed to allow the model to use its full capacity
  });
}

/**
 * Calls the NATIVE OPENAI embedding API.
 * @param modelName The name of the embedding model to use.
 * @param texts The array of strings to embed.
 * @returns The API response.
 */
export async function callOpenAIEmbeddings(
  modelName: string,
  texts: string[]
) {
  // This function now uses the native OpenAI client
  return nativeOpenAI.embeddings.create({
    model: modelName,
    input: texts,
  });
}