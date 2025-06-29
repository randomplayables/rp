import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionMessage,
  ChatCompletionSystemMessageParam
} from "openai/resources/chat/completions";

// Initialize OpenAI client for OpenRouter
const openAI = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://randomplayables.com",
    "X-Title": "randomplayables",
  },
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
  const max_tokens = customMaxTokens ?? (modelName.includes('o4-mini') ? 4000 : 2000);

  // Format messages for API compatibility (especially for text-only vs. multimodal models)
  const messagesForApi = messages.map(msg => {
    if (msg.role === "system" || msg.role === "assistant") {
        return msg; // System and assistant messages usually have string content
    }
    // For user messages, ensure content is in the correct format
    if (typeof msg.content === 'string') {
        // Models like Llama and Deepseek prefer simple string content for user role
        if (modelName.startsWith("meta-llama/") || modelName.startsWith("deepseek/")) {
            return { role: msg.role, content: msg.content };
        }
        // Other models, especially multimodal ones, expect content as an array of parts
        return { role: msg.role, content: [{ type: "text", text: msg.content }] };
    }
    // If content is already an array (e.g., for multimodal), pass it as is
    return msg;
  });

  return openAI.chat.completions.create({
    model: modelName,
    messages: messagesForApi as any, // Cast to any if OpenAI types cause issues with specific structures
    temperature: 0.7,
    max_tokens: max_tokens,
  });
}

/**
 * Interface for the raw outputs from the AI review cycle.
 */
export interface AiReviewCycleRawOutputs {
  chatbot1InitialResponse: ChatCompletionMessage;
  chatbot2ReviewResponse: ChatCompletionMessage;
  chatbot1RevisionResponse: ChatCompletionMessage;
}

/**
 * Orchestrates a dual-chatbot review cycle.
 * Chatbot1 generates initial content, Chatbot2 reviews it, and Chatbot1 revises.
 *
 * @param chatbot1Model - Model for the primary AI.
 * @param systemMessageForChatbot1 - System prompt for the primary AI.
 * @param userMessagesForChatbot1 - Initial user messages for the primary AI's first generation.
 * @param chatbot2Model - Model for the reviewer AI.
 * @param systemMessageForChatbot2 - System prompt for the reviewer AI (Chatbot2).
 * @param createReviewerUserMessageContent - Function to generate the user message content for the reviewer AI.
 * It takes the initial generation content from Chatbot1.
 * @param createRevisionUserMessageContent - Function to generate the user message content for the primary AI's revision pass.
 * It takes the initial generation content and the review content.
 * @returns A promise resolving to an object containing the raw responses from each step of the cycle.
 */
export async function performAiReviewCycle(
  chatbot1Model: string,
  systemMessageForChatbot1: ChatCompletionSystemMessageParam,
  userMessagesForChatbot1: ChatCompletionMessageParam[],
  chatbot2Model: string,
  systemMessageForChatbot2: ChatCompletionSystemMessageParam | null, // <<< MODIFIED: Added this parameter
  createReviewerUserMessageContent: (initialGenerationContent: string | null) => string,
  createRevisionUserMessageContent: (initialGenerationContent: string | null, reviewContent: string | null) => string,
): Promise<AiReviewCycleRawOutputs> {

  // 1. Chatbot1 generates initial content
  const messagesToChatbot1Initial = [systemMessageForChatbot1, ...userMessagesForChatbot1];
  const response1 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Initial);
  const chatbot1InitialResponse = response1.choices[0].message;

  // 2. Chatbot2 reviews the content
  const reviewUserMessageContent = createReviewerUserMessageContent(chatbot1InitialResponse.content);
  const messagesToChatbot2: ChatCompletionMessageParam[] = [];
  if (systemMessageForChatbot2) { // <<< MODIFIED: Add system prompt for Chatbot2 if provided
    messagesToChatbot2.push(systemMessageForChatbot2);
  }
  messagesToChatbot2.push({ role: "user", content: reviewUserMessageContent });
  const response2 = await callOpenAIChat(chatbot2Model, messagesToChatbot2);
  const chatbot2ReviewResponse = response2.choices[0].message;

  // 3. Chatbot1 revises the content
  const revisionUserMessageContent = createRevisionUserMessageContent(chatbot1InitialResponse.content, chatbot2ReviewResponse.content);
  const messagesToChatbot1Revision: ChatCompletionMessageParam[] = [
    systemMessageForChatbot1, // Chatbot1 uses its original system prompt for revision context
    { role: "user", content: revisionUserMessageContent }
  ];
  const response3 = await callOpenAIChat(chatbot1Model, messagesToChatbot1Revision);
  const chatbot1RevisionResponse = response3.choices[0].message;

  return {
    chatbot1InitialResponse,
    chatbot2ReviewResponse,
    chatbot1RevisionResponse,
  };
}

/**
 * Calls the OpenAI-compatible embedding API (OpenRouter).
 * @param modelName The name of the embedding model to use.
 * @param texts The array of strings to embed.
 * @returns The API response.
 */
export async function callOpenAIEmbeddings(
  modelName: string,
  texts: string[]
) {
  return openAI.embeddings.create({
    model: modelName,
    input: texts,
  });
}