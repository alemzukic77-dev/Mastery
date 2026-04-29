/**
 * Tests for POST /api/extract.
 *
 * Heavy mocking of Firebase Admin, Storage, the extractor pipeline, and
 * rate-limiter — the goal is to verify the route's auth gating, input
 * validation, and high-level error contract, not to exercise the full
 * extraction stack (the extractors and validation rules have their own tests).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  rateLimitCheck: vi.fn().mockResolvedValue(undefined),
  extract: vi.fn(),
  runValidation: vi.fn(),
  applyAggregateDelta: vi.fn().mockResolvedValue(undefined),
  docGet: vi.fn(),
  docUpdate: vi.fn().mockResolvedValue(undefined),
  fileDownload: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "__SERVER_TS__",
    increment: (n: number) => ({ __increment: n }),
  },
}));

vi.mock("@/lib/firebase/admin", () => {
  const documentDoc = {
    get: mocks.docGet,
    update: mocks.docUpdate,
  };
  const documentsCollection = {
    doc: vi.fn(() => documentDoc),
  };
  const userDoc = {
    collection: vi.fn(() => documentsCollection),
  };
  const usersCollection = {
    doc: vi.fn(() => userDoc),
  };
  const db = {
    collection: vi.fn(() => usersCollection),
    batch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  };
  const file = {
    download: mocks.fileDownload,
  };
  return {
    adminAuth: () => ({ verifyIdToken: mocks.verifyIdToken }),
    adminDb: () => db,
    adminStorage: () => ({ bucket: () => ({ file: () => file }) }),
  };
});

vi.mock("@/lib/extractors", () => ({
  extract: mocks.extract,
}));

vi.mock("@/lib/validation/runner", () => ({
  runValidation: mocks.runValidation,
}));

vi.mock("@/lib/aggregates", () => ({
  aggregateInputsFromDoc: () => null,
  applyAggregateDelta: mocks.applyAggregateDelta,
}));

vi.mock("@/lib/ratelimit", async () => {
  // Real RateLimitError class so `instanceof` in the route works.
  class RateLimitError extends Error {
    constructor(
      public window: "minute" | "hour" | "day",
      public limit: number,
      public retryAfterSec: number,
    ) {
      super(`rate limit hit on window=${window}`);
      this.name = "RateLimitError";
    }
  }
  return {
    RateLimitError,
    checkAndIncrementRateLimit: mocks.rateLimitCheck,
  };
});

import { POST } from "./route";
import { RateLimitError } from "@/lib/ratelimit";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: rate limiter passes through.
  mocks.rateLimitCheck.mockResolvedValue(undefined);
});

function buildReq(body: unknown, opts?: { auth?: string | null }) {
  const headers = new Headers();
  if (opts?.auth !== null) {
    headers.set("authorization", opts?.auth ?? "Bearer valid-token");
  }
  headers.set("content-type", "application/json");
  return new NextRequest("http://localhost/api/extract", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(buildReq({ documentId: "doc-1" }, { auth: null }));
    expect(res.status).toBe(401);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification fails", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("invalid token"));
    const res = await POST(buildReq({ documentId: "doc-1" }));
    expect(res.status).toBe(401);
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.rateLimitCheck.mockRejectedValueOnce(
      new RateLimitError("minute", 30, 42),
    );
    const res = await POST(buildReq({ documentId: "doc-1" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    const json = await res.json();
    expect(json.window).toBe("minute");
  });

  it("returns 400 when documentId is missing from body", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    const res = await POST(buildReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the target document does not exist", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const res = await POST(buildReq({ documentId: "doc-1" }));
    expect(res.status).toBe(404);
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("returns 400 when doc has no original file reference", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "uploaded" }),
    });
    const res = await POST(buildReq({ documentId: "doc-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 422 with a needs_review patch when the extractor throws", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "uploaded",
        originalFile: {
          storagePath: "users/user-A/documents/doc-1/file.pdf",
          contentType: "application/pdf",
          fileName: "file.pdf",
          size: 1234,
        },
      }),
    });
    mocks.fileDownload.mockResolvedValueOnce([Buffer.from("fake-pdf-bytes")]);
    mocks.extract.mockRejectedValueOnce(new Error("LLM exploded"));

    const res = await POST(buildReq({ documentId: "doc-1" }));
    expect(res.status).toBe(422);

    // Document must be patched to needs_review with an EXTRACTION_FAILED issue —
    // never silently dropped on the floor.
    const updateCall = mocks.docUpdate.mock.calls[0][0];
    expect(updateCall.status).toBe("needs_review");
    expect(updateCall.validationIssues[0].code).toBe("EXTRACTION_FAILED");
    expect(updateCall.validationIssues[0].message).toContain("LLM exploded");
  });

  it("happy path: persists the extracted document and returns 200", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "uploaded",
        originalFile: {
          storagePath: "users/user-A/documents/doc-1/file.txt",
          contentType: "text/plain",
          fileName: "invoice.txt",
          size: 200,
        },
      }),
    });
    mocks.fileDownload.mockResolvedValueOnce([Buffer.from("Invoice INV-001 total 100 USD")]);

    const extracted = {
      type: "invoice" as const,
      supplier: "Acme",
      documentNumber: "INV-001",
      issueDate: "2026-01-01",
      dueDate: null,
      currency: "USD",
      lineItems: [],
      subtotal: null,
      tax: null,
      total: 100,
    };
    mocks.extract.mockResolvedValueOnce({
      documents: [extracted],
      raw: { _raw: true },
    });
    mocks.runValidation.mockResolvedValueOnce({
      data: extracted,
      issues: [],
      status: "validated",
    });

    const res = await POST(buildReq({ documentId: "doc-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      documentId: "doc-1",
      status: "validated",
      issuesCount: 0,
      extractedCount: 1,
    });
    expect(mocks.docUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "validated",
        validationIssues: [],
        rawExtraction: { _raw: true },
      }),
    );
  });

  it("rejects oversized files with 413", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "uploaded",
        originalFile: {
          storagePath: "users/user-A/documents/doc-1/big.pdf",
          contentType: "application/pdf",
          fileName: "big.pdf",
          size: 11 * 1024 * 1024,
        },
      }),
    });
    // 11 MB buffer exceeds the 10 MB route cap.
    mocks.fileDownload.mockResolvedValueOnce([Buffer.alloc(11 * 1024 * 1024, 0)]);

    const res = await POST(buildReq({ documentId: "doc-1" }));
    expect(res.status).toBe(413);
    expect(mocks.extract).not.toHaveBeenCalled();
  });
});
