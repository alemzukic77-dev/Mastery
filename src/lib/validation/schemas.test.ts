import { describe, expect, it } from "vitest";
import { extractedDataSchema, safeParseExtraction } from "./schemas";

describe("extractedDataSchema", () => {
  it("parses a complete valid object", () => {
    const result = extractedDataSchema.safeParse({
      type: "invoice",
      supplier: "Acme",
      documentNumber: "INV-1",
      issueDate: "2026-01-01",
      dueDate: "2026-02-01",
      currency: "USD",
      lineItems: [
        { description: "Item", quantity: 1, unitPrice: 10, amount: 10 },
      ],
      subtotal: 10,
      tax: 1,
      total: 11,
    });
    expect(result.success).toBe(true);
  });

  it("fills defaults for omitted optional fields", () => {
    const result = extractedDataSchema.parse({
      type: "invoice",
      supplier: "X",
      documentNumber: "1",
      total: 10,
    });
    expect(result.lineItems).toEqual([]);
    expect(result.currency).toBeNull();
    expect(result.subtotal).toBeNull();
  });

  it("safeParseExtraction returns null on rubbish", () => {
    expect(safeParseExtraction(null)).toBeNull();
    expect(safeParseExtraction({ type: "invoice", total: "not-a-number" })).toBeNull();
  });

  it("safeParseExtraction returns parsed for valid input", () => {
    const out = safeParseExtraction({
      type: "purchase_order",
      supplier: "S",
      documentNumber: "PO-1",
      issueDate: "2026-01-01",
      total: 100,
    });
    expect(out).not.toBeNull();
    expect(out?.type).toBe("purchase_order");
  });

  it("safeParseExtraction picks first element when LLM returns array", () => {
    const out = safeParseExtraction([
      { type: "invoice", supplier: "First", documentNumber: "1", total: 100 },
      { type: "invoice", supplier: "Second", documentNumber: "2", total: 200 },
    ]);
    expect(out?.supplier).toBe("First");
    expect(out?.documentNumber).toBe("1");
  });

  it("safeParseExtraction unwraps { documents: [...] } envelope", () => {
    const out = safeParseExtraction({
      documents: [
        { type: "invoice", supplier: "Wrapped", documentNumber: "1", total: 50 },
      ],
    });
    expect(out?.supplier).toBe("Wrapped");
  });

  it("safeParseExtraction unwraps { invoice: {...} } envelope", () => {
    const out = safeParseExtraction({
      invoice: {
        type: "invoice",
        supplier: "Inner",
        documentNumber: "9",
        total: 75,
      },
    });
    expect(out?.supplier).toBe("Inner");
  });
});
