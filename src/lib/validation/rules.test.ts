import { describe, expect, it } from "vitest";
import {
  autoComputeTotal,
  checkCurrencies,
  checkDates,
  checkLineItems,
  checkRequiredFields,
  checkTotal,
} from "./rules";
import type { ExtractedData } from "@/lib/types";

const baseDoc: ExtractedData = {
  type: "invoice",
  supplier: "Acme Corp",
  documentNumber: "INV-001",
  issueDate: "2026-01-10",
  dueDate: "2026-02-10",
  currency: "USD",
  lineItems: [
    { description: "Widget", quantity: 2, unitPrice: 50, amount: 100 },
    { description: "Service", quantity: 1, unitPrice: 200, amount: 200 },
  ],
  subtotal: 300,
  tax: 30,
  total: 330,
};

describe("checkRequiredFields", () => {
  it("returns no issues when all required fields are present", () => {
    expect(checkRequiredFields(baseDoc)).toEqual([]);
  });

  it("flags each missing required field", () => {
    const doc = { ...baseDoc, supplier: null, documentNumber: null };
    const issues = checkRequiredFields(doc);
    expect(issues.map((i) => i.field).sort()).toEqual([
      "documentNumber",
      "supplier",
    ]);
    expect(issues.every((i) => i.code === "MISSING_FIELD")).toBe(true);
    expect(issues.every((i) => i.severity === "error")).toBe(true);
  });

  it("treats empty string as missing", () => {
    const doc = { ...baseDoc, supplier: "" };
    const issues = checkRequiredFields(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("supplier");
  });
});

describe("checkTotal", () => {
  it("returns no issues when total matches line items + tax", () => {
    expect(checkTotal(baseDoc)).toEqual([]);
  });

  it("flags TOTAL_MISMATCH when total is wrong", () => {
    const doc = { ...baseDoc, total: 400 };
    const issues = checkTotal(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("TOTAL_MISMATCH");
    expect(issues[0].severity).toBe("error");
  });

  it("tolerates floating point rounding", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      lineItems: [
        { description: "A", quantity: 3, unitPrice: 33.33, amount: 99.99 },
      ],
      tax: 0,
      total: 99.99,
    };
    expect(checkTotal(doc)).toEqual([]);
  });

  it("skips check when total or line items are missing", () => {
    expect(checkTotal({ ...baseDoc, total: null })).toEqual([]);
    expect(checkTotal({ ...baseDoc, lineItems: [] })).toEqual([]);
  });
});

describe("checkDates", () => {
  it("returns no issues for valid dates", () => {
    expect(checkDates(baseDoc)).toEqual([]);
  });

  it("flags invalid issueDate", () => {
    const issues = checkDates({ ...baseDoc, issueDate: "not-a-date" });
    expect(issues.some((i) => i.code === "INVALID_DATE" && i.field === "issueDate")).toBe(true);
  });

  it("flags DATE_ORDER when due is before issue", () => {
    const issues = checkDates({
      ...baseDoc,
      issueDate: "2026-02-10",
      dueDate: "2026-01-10",
    });
    expect(issues.some((i) => i.code === "DATE_ORDER")).toBe(true);
  });

  it("accepts identical issue and due dates", () => {
    const issues = checkDates({
      ...baseDoc,
      issueDate: "2026-01-10",
      dueDate: "2026-01-10",
    });
    expect(issues).toEqual([]);
  });
});

describe("checkLineItems", () => {
  it("returns no issues when lines match", () => {
    expect(checkLineItems(baseDoc)).toEqual([]);
  });

  it("flags each line where quantity * unitPrice does not match amount", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      lineItems: [
        { description: "Bad", quantity: 2, unitPrice: 50, amount: 90 },
        { description: "OK", quantity: 1, unitPrice: 10, amount: 10 },
        { description: "Bad2", quantity: 3, unitPrice: 5, amount: 20 },
      ],
    };
    const issues = checkLineItems(doc);
    expect(issues).toHaveLength(2);
    expect(issues[0].code).toBe("LINE_ITEM_MISMATCH");
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].field).toBe("lineItems[0].amount");
    expect(issues[1].field).toBe("lineItems[2].amount");
  });

  it("ignores non-finite values gracefully", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      lineItems: [
        { description: "Junk", quantity: NaN, unitPrice: 10, amount: 10 },
      ],
    };
    expect(checkLineItems(doc)).toEqual([]);
  });
});

describe("autoComputeTotal", () => {
  it("computes total from subtotal + tax when total is null", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      total: null,
      subtotal: 2390,
      tax: 478,
    };
    const { data, issues } = autoComputeTotal(doc);
    expect(data.total).toBe(2868);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("COMPUTED_TOTAL");
    expect(issues[0].severity).toBe("warning");
  });

  it("does not modify total when it's already present", () => {
    const doc: ExtractedData = { ...baseDoc, total: 100 };
    const { data, issues } = autoComputeTotal(doc);
    expect(data.total).toBe(100);
    expect(issues).toEqual([]);
  });

  it("does not compute when subtotal is missing", () => {
    const doc: ExtractedData = { ...baseDoc, total: null, subtotal: null };
    const { data, issues } = autoComputeTotal(doc);
    expect(data.total).toBeNull();
    expect(issues).toEqual([]);
  });

  it("does not compute when tax is missing", () => {
    const doc: ExtractedData = { ...baseDoc, total: null, tax: null };
    const { data, issues } = autoComputeTotal(doc);
    expect(data.total).toBeNull();
    expect(issues).toEqual([]);
  });

  it("rounds computed total to 2 decimals", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      total: null,
      subtotal: 100.111,
      tax: 22.224,
    };
    const { data } = autoComputeTotal(doc);
    expect(data.total).toBe(122.34);
  });
});

describe("checkCurrencies", () => {
  it("returns no issues when all line items match document currency", () => {
    expect(checkCurrencies(baseDoc)).toEqual([]);
  });

  it("returns no issues when line items have null currency (default to doc currency)", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      currency: "USD",
      lineItems: [
        { description: "A", quantity: 1, unitPrice: 10, amount: 10, currency: null },
        { description: "B", quantity: 1, unitPrice: 20, amount: 20 },
      ],
    };
    expect(checkCurrencies(doc)).toEqual([]);
  });

  it("flags MIXED_CURRENCIES when a line uses different currency", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      currency: "EUR",
      lineItems: [
        { description: "Local", quantity: 1, unitPrice: 100, amount: 100 },
        { description: "Foreign", quantity: 1, unitPrice: 50, amount: 50, currency: "USD" },
      ],
    };
    const issues = checkCurrencies(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("MIXED_CURRENCIES");
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("EUR");
    expect(issues[0].message).toContain("USD");
  });

  it("treats currency comparison case-insensitively", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      currency: "eur",
      lineItems: [
        { description: "X", quantity: 1, unitPrice: 1, amount: 1, currency: "EUR" },
      ],
    };
    expect(checkCurrencies(doc)).toEqual([]);
  });

  it("returns no issues when document currency is missing", () => {
    const doc: ExtractedData = {
      ...baseDoc,
      currency: null,
      lineItems: [
        { description: "X", quantity: 1, unitPrice: 1, amount: 1, currency: "USD" },
      ],
    };
    expect(checkCurrencies(doc)).toEqual([]);
  });
});
