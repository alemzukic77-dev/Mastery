import "server-only";
import Papa from "papaparse";
import { getExtractionModel } from "@/lib/llm/gemini";
import { TEXT_EXTRACTION_USER_PROMPT } from "@/lib/llm/prompts";
import { safeParseExtractions } from "@/lib/validation/schemas";
import type { ExtractorInput, ExtractorResult } from "./index";

export async function extractFromCsv(
  input: ExtractorInput,
): Promise<ExtractorResult> {
  const csvText = input.buffer.toString("utf-8");

  const parsed = Papa.parse<string[]>(csvText.trim(), {
    skipEmptyLines: true,
  });

  const normalized = parsed.data
    .map((row) =>
      Array.isArray(row)
        ? row.map((cell) => String(cell ?? "").trim()).join(" | ")
        : "",
    )
    .filter(Boolean)
    .join("\n");

  const model = getExtractionModel();
  const result = await model.generateContent(
    TEXT_EXTRACTION_USER_PROMPT(normalized || csvText),
  );
  const text = result.response.text();
  const json = JSON.parse(text);
  const documents = safeParseExtractions(json);
  if (documents.length === 0) {
    throw new Error("Extraction did not match expected schema");
  }
  return { documents, raw: json };
}
