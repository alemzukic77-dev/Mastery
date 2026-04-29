import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().default(""),
  quantity: z.number(),
  unitPrice: z.number(),
  amount: z.number(),
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
  const result = extractedDataSchema.safeParse(raw);
  if (result.success) return result.data;
  return null;
}
