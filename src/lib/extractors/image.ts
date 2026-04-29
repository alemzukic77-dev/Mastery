import "server-only";
import { getExtractionModel } from "@/lib/llm/gemini";
import { FILE_EXTRACTION_USER_PROMPT } from "@/lib/llm/prompts";
import { safeParseExtraction } from "@/lib/validation/schemas";
import type { ExtractorInput, ExtractorResult } from "./index";

export async function extractFromImage(
  input: ExtractorInput,
): Promise<ExtractorResult> {
  const model = getExtractionModel();
  const mimeType = input.mimeType || "image/png";

  const result = await model.generateContent([
    { text: FILE_EXTRACTION_USER_PROMPT },
    {
      inlineData: {
        mimeType,
        data: input.buffer.toString("base64"),
      },
    },
  ]);
  const text = result.response.text();
  const json = JSON.parse(text);
  const data = safeParseExtraction(json);
  if (!data) throw new Error("Extraction did not match expected schema");
  return { data, raw: json };
}
