import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const {
  requireAuthenticatedRouteContext,
  requireSocietyAccess,
  createClient,
  downloadMock,
  createSignedUrlMock,
  listBucketsMock,
  createBucketMock,
  createSignedUploadUrlMock,
} = vi.hoisted(() => {
  const downloadMock = vi.fn();
  const createSignedUrlMock = vi.fn();
  const createSignedUploadUrlMock = vi.fn();
  const fromMock = vi.fn(() => ({
    download: downloadMock,
    createSignedUrl: createSignedUrlMock,
    createSignedUploadUrl: createSignedUploadUrlMock,
  }));

  return {
    requireAuthenticatedRouteContext: vi.fn(),
    requireSocietyAccess: vi.fn(),
    createClient: vi.fn(() => ({
      storage: {
        from: fromMock,
        listBuckets: listBucketsMock,
        createBucket: createBucketMock,
      },
    })),
    downloadMock,
    createSignedUrlMock,
    listBucketsMock: vi.fn(),
    createBucketMock: vi.fn(),
    createSignedUploadUrlMock,
  };
});

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRouteContext,
}));

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
  return {
    ...actual,
    requireSocietyAccess,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { GET as viewFile } from "./view/route";
import { POST as signedUpload } from "./signed-upload/route";

describe("storage routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedRouteContext.mockResolvedValue({ userId: "user-1" });
    requireSocietyAccess.mockResolvedValue(undefined);
    downloadMock.mockResolvedValue({
      data: new Blob(["hello"], { type: "text/plain" }),
      error: null,
    });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/file" },
      error: null,
    });
    listBucketsMock.mockResolvedValue({
      data: [{ name: "documents" }],
    });
    createBucketMock.mockResolvedValue({ error: null });
    createSignedUploadUrlMock.mockResolvedValue({
      data: { signedUrl: "https://upload.example/signed", token: "token-1" },
      error: null,
    });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "active-society-id" ? { name, value: "society-1" } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.SUPABASE_STORAGE_BUCKET = "documents";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  describe("GET /api/storage/view", () => {
    it("propage la réponse 401 si non authentifié", async () => {
      requireAuthenticatedRouteContext.mockResolvedValue(
        NextResponse.json({ error: "Non authentifié" }, { status: 401 })
      );

      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=documents/society-1/test.pdf")
      );
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body).toEqual({ error: "Non authentifié" });
    });

    it("rejette un path traversal encodé", async () => {
      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=%252e%252e%252fsecret.pdf")
      );

      expect(res.status).toBe(400);
      expect(downloadMock).not.toHaveBeenCalled();
    });

    it("retourne 403 si l'utilisateur n'a pas accès à la société du fichier", async () => {
      requireSocietyAccess.mockRejectedValue(new Error("forbidden"));

      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=documents/society-2/test.pdf")
      );

      expect(res.status).toBe(403);
    });

    it("autorise temp/<userId>/... sans contrôle société", async () => {
      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=temp/user-1/import/test.pdf")
      );
      const body = await res.text();

      expect(res.status).toBe(200);
      expect(body).toBe("hello");
      expect(requireSocietyAccess).not.toHaveBeenCalled();
    });

    it("autorise temp/<societyId>/... via contrôle société", async () => {
      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=temp/society-1/import/test.pdf")
      );

      expect(res.status).toBe(200);
      expect(requireSocietyAccess).toHaveBeenCalledWith("user-1", "society-1");
    });

    it("bascule sur une URL signée si le download direct échoue", async () => {
      downloadMock.mockResolvedValue({
        data: null,
        error: { message: "not found" },
      });

      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=documents/society-1/test.pdf")
      );

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://signed.example/file");
    });
  });

  describe("POST /api/storage/signed-upload", () => {
    it("retourne 400 si le nom de fichier manque", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toEqual({ error: "Nom de fichier requis" });
    });

    it("retourne 400 si entityFolder contient une traversée", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "piece.pdf",
            societyId: "society-1",
            entityFolder: "../../secret",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toEqual({ error: "Dossier cible invalide" });
    });

    it("retourne 403 si la société active ne correspond pas pour un upload document", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: (name: string) =>
          name === "active-society-id" ? { name, value: "society-2" } : undefined,
      } as Awaited<ReturnType<typeof cookies>>);

      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "piece.pdf",
            societyId: "society-1",
            entityFolder: "general",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );

      expect(res.status).toBe(403);
    });

    it("génère un path document avec dossier nettoyé et contrôle GESTIONNAIRE", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "piece.pdf",
            societyId: "society-1",
            entityFolder: "crg/lease-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(requireSocietyAccess).toHaveBeenCalledWith("user-1", "society-1", "GESTIONNAIRE");
      expect(body.storagePath).toMatch(/^documents\/society-1\/crg\/lease-1\/\d+_piece\.pdf$/);
    });

    it("impose un accès ADMIN_SOCIETE pour l'upload de logo", async () => {
      await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "logo.png",
            societyId: "society-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );

      expect(requireSocietyAccess).toHaveBeenCalledWith("user-1", "society-1", "ADMIN_SOCIETE");
    });

    it("génère un path temporaire par user quand societyId est absent", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "draft.pdf",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.storagePath).toMatch(/^temp\/user-1\/\d+_draft\.pdf$/);
      expect(requireSocietyAccess).not.toHaveBeenCalled();
    });
  });
});
