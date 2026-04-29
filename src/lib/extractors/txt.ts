import "server-only";
import { getExtractionModel } from "@/lib/llm/gemini";
import { TEXT_EXTRACTION_USER_PROMPT } from "@/lib/llm/prompts";
import { safeParseExtractions } from "@/lib/validation/schemas";
import type { ExtractorInput, ExtractorResult } from "./index";

export async function extractFromTxt(
  input: ExtractorInput,
): Promise<ExtractorResult> {
  const text = input.buffer.toString("utf-8").trim();
  if (!text) throw new Error("Text file is empty");

  const model = getExtractionModel();
  const result = await model.generateContent(TEXT_EXTRACTION_USER_PROMPT(text));
  const responseText = result.response.text();
  const json = JSON.parse(responseText);
  const documents = safeParseExtractions(json);
  if (documents.length === 0) {
    throw new Error("Extraction did not match expected schema");
  }
  return { documents, raw: json };
}
