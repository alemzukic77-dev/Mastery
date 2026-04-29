import { describe, expect, it } from "vitest";
import { detectFileKind, formatCurrency, formatFileSize } from "./utils";

describe("detectFileKind", () => {
  it("detects pdf via mime type", () => {
    expect(detectFileKind("application/pdf", "x.pdf")).toBe("pdf");
  });

  it("detects image via mime prefix", () => {
    expect(detectFileKind("image/png", "scan.png")).toBe("image");
    expect(detectFileKind("image/jpeg", "scan.jpg")).toBe("image");
  });

  it("falls back to file name when mime is missing", () => {
    expect(detectFileKind("", "Invoice.PDF")).toBe("pdf");
    expect(detectFileKind("", "data.csv")).toBe("csv");
    expect(detectFileKind("", "notes.txt")).toBe("txt");
  });

  it("returns unknown when nothing matches", () => {
    expect(detectFileKind("application/zip", "x.zip")).toBe("unknown");
  });
});

describe("formatCurrency", () => {
  it("formats with given currency", () => {
    expect(formatCurrency(1234.5, "USD")).toContain("1,234.50");
    expect(formatCurrency(1234.5, "EUR")).toContain("1,234.50");
  });

  it("returns dash when amount is null", () => {
    expect(formatCurrency(null, "USD")).toBe("—");
  });

  it("falls back gracefully on unknown currency", () => {
    const result = formatCurrency(10, "ZZZ");
    expect(result).toMatch(/10\.00/);
  });
});

describe("formatFileSize", () => {
  it("uses bytes under 1KB", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });
  it("uses KB between 1KB and 1MB", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });
  it("uses MB above 1MB", () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
