import "server-only";
import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";

let cachedClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

export function getExtractionModel(): GenerativeModel {
  return getGeminiClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: EXTRACTION_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.15,
      responseMimeType: "application/json",
      // Bump to maximum to avoid truncation on multi-doc inputs with many line items
      maxOutputTokens: 8192,
    },
  });
}
