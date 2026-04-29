import "server-only";
import { getExtractionModel } from "@/lib/llm/gemini";
import {
  FILE_EXTRACTION_USER_PROMPT,
  TEXT_EXTRACTION_USER_PROMPT,
} from "@/lib/llm/prompts";
import { safeParseExtraction } from "@/lib/validation/schemas";
import type { ExtractorInput, ExtractorResult } from "./index";

export async function extractFromPdf(
  input: ExtractorInput,
): Promise<ExtractorResult> {
  const model = getExtractionModel();

  // Primary path: send PDF directly to Gemini multimodal
  try {
    const result = await model.generateContent([
      { text: FILE_EXTRACTION_USER_PROMPT },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: input.buffer.toString("base64"),
        },
      },
    ]);
    const text = result.response.text();
    const parsed = safeParseExtraction(JSON.parse(text));
    if (parsed) return { data: parsed, raw: JSON.parse(text) };
  } catch (err) {
    console.warn("[pdf] Gemini multimodal extraction failed, falling back", err);
  }

  // Fallback: extract text with pdf-parse, then send text to Gemini
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(input.buffer);
  const rawText = parsed.text.trim();

  if (!rawText) {
    throw new Error("PDF contains no extractable text");
  }

  const result = await model.generateContent(TEXT_EXTRACTION_USER_PROMPT(rawText));
  const text = result.response.text();
  const json = JSON.parse(text);
  const data = safeParseExtraction(json);
  if (!data) throw new Error("Extraction did not match expected schema");
  return { data, raw: json };
}
