import { describe, expect, it } from "vitest";
import {
  extractedDataSchema,
  safeParseExtraction,
  safeParseExtractions,
} from "./schemas";

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

describe("safeParseExtractions", () => {
  it("returns all documents from { documents: [...] } envelope", () => {
    const out = safeParseExtractions({
      documents: [
        { type: "invoice", supplier: "A", documentNumber: "1", total: 10 },
        { type: "invoice", supplier: "B", documentNumber: "2", total: 20 },
        { type: "invoice", supplier: "C", documentNumber: "3", total: 30 },
      ],
    });
    expect(out).toHaveLength(3);
    expect(out.map((d) => d.supplier)).toEqual(["A", "B", "C"]);
  });

  it("wraps a single object input in array of 1", () => {
    const out = safeParseExtractions({
      type: "invoice",
      supplier: "Solo",
      documentNumber: "1",
      total: 50,
    });
    expect(out).toHaveLength(1);
    expect(out[0].supplier).toBe("Solo");
  });

  it("returns empty array for null/undefined input", () => {
    expect(safeParseExtractions(null)).toEqual([]);
    expect(safeParseExtractions(undefined)).toEqual([]);
  });

  it("filters out invalid entries but keeps valid ones", () => {
    const out = safeParseExtractions({
      documents: [
        { type: "invoice", supplier: "Valid", documentNumber: "1", total: 10 },
        { type: "not-a-valid-type", supplier: 123 }, // bad
        { type: "invoice", supplier: "Also valid", documentNumber: "3", total: 30 },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.supplier)).toEqual(["Valid", "Also valid"]);
  });

  it("tolerates null numbers in line items by coercing to 0", () => {
    const out = safeParseExtractions({
      documents: [
        {
          type: "invoice",
          supplier: "X",
          documentNumber: "1",
          lineItems: [
            { description: "good", quantity: 2, unitPrice: 10, amount: 20 },
            { description: "missing qty", quantity: null, unitPrice: 5, amount: 5 },
            { description: "missing all", quantity: null, unitPrice: null, amount: null },
          ],
          total: 30,
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].lineItems).toHaveLength(3);
    expect(out[0].lineItems[1]).toMatchObject({
      description: "missing qty",
      quantity: 0,
      unitPrice: 5,
      amount: 5,
    });
    expect(out[0].lineItems[2]).toMatchObject({
      description: "missing all",
      quantity: 0,
      unitPrice: 0,
      amount: 0,
    });
  });

  it("tolerates null description by coercing to empty string", () => {
    const out = safeParseExtractions({
      documents: [
        {
          type: "invoice",
          supplier: "X",
          documentNumber: "1",
          lineItems: [
            { description: null, quantity: 1, unitPrice: 10, amount: 10 },
          ],
          total: 10,
        },
      ],
    });
    expect(out[0].lineItems[0].description).toBe("");
  });
});
