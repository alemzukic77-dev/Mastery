import "server-only";
import type { ExtractedData } from "@/lib/types";
import { detectFileKind } from "@/lib/utils";
import { extractFromPdf } from "./pdf";
import { extractFromImage } from "./image";
import { extractFromCsv } from "./csv";
import { extractFromTxt } from "./txt";

export interface ExtractorInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface ExtractorResult {
  data: ExtractedData;
  raw: unknown;
}

export async function extract(input: ExtractorInput): Promise<ExtractorResult> {
  const kind = detectFileKind(input.mimeType, input.fileName);
  switch (kind) {
    case "pdf":
      return extractFromPdf(input);
    case "image":
      return extractFromImage(input);
    case "csv":
      return extractFromCsv(input);
    case "txt":
      return extractFromTxt(input);
    default:
      throw new Error(
        `Unsupported file type: ${input.mimeType} (${input.fileName})`,
      );
  }
}
