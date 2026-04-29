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

export function safeParseExtraction(raw: unknown): ExtractedDataParsed | null {
  // Defensive: if the LLM returned an array (e.g. multiple invoices in one image),
  // take the first element. The prompt asks for a single object, but be tolerant.
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate === undefined || candidate === null) return null;

  // Defensive: if the LLM wrapped the result in { documents: [...] } or { invoice: {...} },
  // unwrap common wrapper keys.
  const unwrapped =
    typeof candidate === "object" && candidate !== null
      ? unwrapPossibleEnvelope(candidate as Record<string, unknown>)
      : candidate;

  const result = extractedDataSchema.safeParse(unwrapped);
  if (result.success) return result.data;
  return null;
}

function unwrapPossibleEnvelope(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  // If object has a known top-level field (type, supplier, total, lineItems), it's the data itself
  if ("type" in obj || "supplier" in obj || "lineItems" in obj || "total" in obj) {
    return obj;
  }
  // Look for common wrapper keys
  for (const key of ["document", "invoice", "data", "result", "documents", "invoices"]) {
    const inner = obj[key];
    if (Array.isArray(inner) && inner.length > 0) {
      return inner[0] as Record<string, unknown>;
    }
    if (inner && typeof inner === "object") {
      return inner as Record<string, unknown>;
    }
  }
  return obj;
}
