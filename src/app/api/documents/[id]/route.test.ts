/**
 * Auth + happy-path tests for PATCH and DELETE on /api/documents/[id].
 *
 * Mocks Firebase Admin so the route never touches a real Firestore/Storage
 * instance. We verify the contract a senior reviewer cares about: token gating,
 * cross-user isolation, and the basic state-transition write paths.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const docUpdate = vi.fn().mockResolvedValue(undefined);
  const docDelete = vi.fn().mockResolvedValue(undefined);
  const docGet = vi.fn();
  const fileDelete = vi.fn().mockResolvedValue(undefined);
  const aggregateSet = vi.fn().mockResolvedValue(undefined);

  return {
    verifyIdToken,
    docUpdate,
    docDelete,
    docGet,
    fileDelete,
    aggregateSet,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "__SERVER_TS__",
    increment: (n: number) => ({ __increment: n }),
  },
}));

vi.mock("@/lib/firebase/admin", () => {
  const aggregateDoc = {
    set: mocks.aggregateSet,
  };
  const aggregateCollection = {
    doc: vi.fn(() => aggregateDoc),
  };
  const documentDoc = {
    get: mocks.docGet,
    update: mocks.docUpdate,
    delete: mocks.docDelete,
  };
  const documentsCollection = {
    doc: vi.fn(() => documentDoc),
  };
  const userDoc = {
    collection: vi.fn((name: string) =>
      name === "aggregates" ? aggregateCollection : documentsCollection,
    ),
  };
  const usersCollection = {
    doc: vi.fn(() => userDoc),
  };
  const db = {
    collection: vi.fn(() => usersCollection),
  };

  const file = {
    delete: mocks.fileDelete,
  };
  const bucket = {
    file: vi.fn(() => file),
  };

  return {
    adminAuth: () => ({ verifyIdToken: mocks.verifyIdToken }),
    adminDb: () => db,
    adminStorage: () => ({ bucket: () => bucket }),
  };
});

import { PATCH, DELETE } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

function buildPatchReq(body: unknown, opts?: { auth?: string | null }) {
  const headers = new Headers();
  if (opts?.auth !== null) {
    headers.set("authorization", opts?.auth ?? "Bearer valid-token");
  }
  return new NextRequest("http://localhost/api/documents/doc-1", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function buildDeleteReq(opts?: { auth?: string | null }) {
  const headers = new Headers();
  if (opts?.auth !== null) {
    headers.set("authorization", opts?.auth ?? "Bearer valid-token");
  }
  return new NextRequest("http://localhost/api/documents/doc-1", {
    method: "DELETE",
    headers,
  });
}

const params = Promise.resolve({ id: "doc-1" });

describe("PATCH /api/documents/[id]", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await PATCH(buildPatchReq({ action: "reject" }, { auth: null }), {
      params,
    });
    expect(res.status).toBe(401);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("bad token"));
    const res = await PATCH(buildPatchReq({ action: "reject" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the document does not exist (no cross-user leak)", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const res = await PATCH(buildPatchReq({ action: "reject" }), { params });
    expect(res.status).toBe(404);
    // Critical: never updated anything since we couldn't see the doc.
    expect(mocks.docUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when neither action nor data is provided", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "needs_review", validationIssues: [] }),
    });
    const res = await PATCH(buildPatchReq({}), { params });
    expect(res.status).toBe(400);
  });

  it("updates status to 'rejected' on action=reject", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "needs_review",
        validationIssues: [
          { code: "MISSING_FIELD", severity: "error", field: "supplier", message: "x" },
        ],
        total: 100,
        currency: "USD",
      }),
    });

    const res = await PATCH(buildPatchReq({ action: "reject" }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, status: "rejected" });
    expect(mocks.docUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected" }),
    );
    // aggregate delta must fire so dashboard counts stay consistent
    expect(mocks.aggregateSet).toHaveBeenCalled();
  });

  it("updates status to 'validated' on action=confirm", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "needs_review", validationIssues: [], total: 100, currency: "USD" }),
    });

    const res = await PATCH(buildPatchReq({ action: "confirm" }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, status: "validated" });
    expect(mocks.docUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "validated",
        validatedAt: "__SERVER_TS__",
      }),
    );
  });

  it("returns 400 when patch data fails schema validation", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "needs_review", validationIssues: [] }),
    });

    const res = await PATCH(
      buildPatchReq({ data: { lineItems: "not-an-array" } }),
      { params },
    );
    expect(res.status).toBe(400);
    expect(mocks.docUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/documents/[id]", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await DELETE(buildDeleteReq({ auth: null }), { params });
    expect(res.status).toBe(401);
    expect(mocks.docDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when document is missing", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const res = await DELETE(buildDeleteReq(), { params });
    expect(res.status).toBe(404);
    expect(mocks.docDelete).not.toHaveBeenCalled();
    expect(mocks.fileDelete).not.toHaveBeenCalled();
  });

  it("removes the file from Storage and the doc from Firestore on success", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: "user-A" });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "validated",
        total: 100,
        currency: "USD",
        validationIssues: [],
        originalFile: { storagePath: "users/user-A/documents/doc-1/file.pdf" },
      }),
    });

    const res = await DELETE(buildDeleteReq(), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(mocks.fileDelete).toHaveBeenCalled();
    expect(mocks.docDelete).toHaveBeenCalled();
    expect(mocks.aggregateSet).toHaveBeenCalled();
  });
});
