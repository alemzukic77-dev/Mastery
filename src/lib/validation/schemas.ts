import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().default(""),
  quantity: z.number(),
  unitPrice: z.number(),
  amount: z.number(),
  currency: z.string().nullable().optional(),
});

export const extractedDataSchema = z.object({
  type: z.enum(["invoice", "purchase_order", "unknown"]).default("unknown"),
  supplier: z.string().nullable().default(null),
  documentNumber: z.string().nullable().default(null),
  issueDate: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  currency: z.string().nullable().default(null),
  lineItems: z.array(lineItemSchema).default([]),
  subtotal: z.number().nullable().default(null),
  tax: z.number().nullable().default(null),
  total: z.number().nullable().default(null),
});

export type ExtractedDataInput = z.input<typeof extractedDataSchema>;
export type ExtractedDataParsed = z.output<typeof extractedDataSchema>;

/**
 * Extract a single document from the LLM output.
 * Tolerates: array of docs, { documents: [...] } wrapper, single object.
 * Returns the FIRST valid extraction or null.
 */
export function safeParseExtraction(raw: unknown): ExtractedDataParsed | null {
  const all = safeParseExtractions(raw);
  return all.length > 0 ? all[0] : null;
}

/**
 * Parse one or more documents from LLM output. Always returns an array
 * (empty if nothing valid was found). Accepts these shapes:
 *  - { documents: [{...}, {...}] }       (preferred LLM contract)
 *  - [{...}, {...}]                       (bare array)
 *  - {...}                                (single object — wrapped in array of 1)
 *  - { invoice: {...} } / { data: {...} } (legacy single-object envelopes)
 */
export function safeParseExtractions(raw: unknown): ExtractedDataParsed[] {
  const candidates = normalizeToArray(raw);
  const results: ExtractedDataParsed[] = [];
  for (const candidate of candidates) {
    const parsed = extractedDataSchema.safeParse(candidate);
    if (parsed.success) results.push(parsed.data);
  }
  return results;
}

function normalizeToArray(raw: unknown): unknown[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;

  // Preferred shape: { documents: [...] }
  if (Array.isArray(obj.documents)) return obj.documents as unknown[];

  // Legacy / alternate envelopes: { invoices: [...] }, { data: [...] }, { results: [...] }
  for (const key of ["invoices", "data", "results"]) {
    const inner = obj[key];
    if (Array.isArray(inner)) return inner as unknown[];
  }

  // Single-object envelopes: { invoice: {...} }, { document: {...} }, { data: {...} }
  for (const key of ["invoice", "document", "data", "result"]) {
    const inner = obj[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return [inner];
    }
  }

  // Single document at top level (has known field) — wrap in array
  if ("type" in obj || "supplier" in obj || "lineItems" in obj || "total" in obj) {
    return [obj];
  }

  return [];
}
