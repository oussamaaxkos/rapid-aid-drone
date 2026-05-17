import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const createOpenAiProvider = (openAiApiKey: string) =>
  createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey: openAiApiKey,
  });
