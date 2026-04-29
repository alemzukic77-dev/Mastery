import "server-only";
import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

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
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });
}
