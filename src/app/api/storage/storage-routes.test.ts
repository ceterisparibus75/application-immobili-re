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

vi.mock("@/lib/env", () => ({ env: process.env }));

import { GET as viewFile } from "./view/route";
import { POST as signedUpload } from "./signed-upload/route";
import { POST as tusPatch } from "./tus-patch/route";

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

    it("contrôle l'accès société pour les quittances générées", async () => {
      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=quittances/society-1/2026/quittance.pdf")
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

    it("force le téléchargement des SVG au lieu de les servir inline", async () => {
      downloadMock.mockResolvedValue({
        data: new Blob(["<svg></svg>"], { type: "image/svg+xml" }),
        error: null,
      });

      const res = await viewFile(
        new NextRequest("http://localhost/api/storage/view?path=documents/society-1/logo.svg")
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/octet-stream");
      expect(res.headers.get("content-disposition")).toContain("attachment");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
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
            contentType: "application/pdf",
            fileSize: 1024,
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
            contentType: "application/pdf",
            fileSize: 1024,
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
      expect(body.contentType).toBe("application/pdf");
    });

    it("rejette un upload document si extension et type MIME divergent", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "piece.pdf",
            contentType: "image/png",
            fileSize: 1024,
            societyId: "society-1",
            entityFolder: "general",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("extension");
    });

    it("impose un accès ADMIN_SOCIETE pour l'upload de logo", async () => {
      await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "logo.png",
            contentType: "image/png",
            fileSize: 128 * 1024,
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

    // ── F-007 : validation logo ───────────────────────────────────────────────

    it("rejette un logo avec un MIME non autorisé (ex: PDF)", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "logo.pdf",
            contentType: "application/pdf",
            fileSize: 1024,
            societyId: "society-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("Format non supporté pour un logo");
    });

    it("rejette un logo SVG (non dans l'allowlist)", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "logo.svg",
            contentType: "image/svg+xml",
            fileSize: 1024,
            societyId: "society-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );

      expect(res.status).toBe(400);
    });

    it("rejette un logo sans taille de fichier", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "logo.png",
            contentType: "image/png",
            societyId: "society-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("invalide");
    });

    it("rejette un logo trop volumineux (> 5 Mo)", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "logo.png",
            contentType: "image/png",
            fileSize: 6 * 1024 * 1024,
            societyId: "society-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("5 Mo");
    });

    it("accepte un logo PNG valide et génère le storagePath correct", async () => {
      const res = await signedUpload(
        new NextRequest("http://localhost/api/storage/signed-upload", {
          method: "POST",
          body: JSON.stringify({
            filename: "logo.png",
            contentType: "image/png",
            fileSize: 512 * 1024,
            societyId: "society-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.storagePath).toMatch(/^logos\/society-1\/\d+_logo\.png$/);
    });
  });

  // ── F-007 : TUS patch — détection contenu dangereux ──────────────────────

  describe("POST /api/storage/tus-patch", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    });

    function makeTusPatchRequest(body: ArrayBuffer, tusUrl = "https://supabase.example/storage/v1/upload/resumable/abc", offset = "0") {
      return new NextRequest("http://localhost/api/storage/tus-patch", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/offset+octet-stream",
          "x-tus-url": tusUrl,
          "x-upload-offset": offset,
        },
      });
    }

    it("rejette si x-tus-url est absent", async () => {
      const req = new NextRequest("http://localhost/api/storage/tus-patch", {
        method: "POST",
        body: new ArrayBuffer(4),
        headers: { "Content-Type": "application/offset+octet-stream" },
      });

      const res = await tusPatch(req);
      expect(res.status).toBe(400);
    });

    it("rejette un contenu HTML en premier chunk (offset=0)", async () => {
      const html = new TextEncoder().encode("<html><body>Hello</body></html>");
      const res = await tusPatch(makeTusPatchRequest(html.buffer as ArrayBuffer));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("dangereux");
    });

    it("rejette un contenu SVG en premier chunk", async () => {
      const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
      const res = await tusPatch(makeTusPatchRequest(svg.buffer as ArrayBuffer));

      expect(res.status).toBe(400);
    });

    it("rejette un contenu XML en premier chunk", async () => {
      const xml = new TextEncoder().encode("<?xml version='1.0'?><root/>");
      const res = await tusPatch(makeTusPatchRequest(xml.buffer as ArrayBuffer));

      expect(res.status).toBe(400);
    });

    it("ne vérifie pas le contenu pour les chunks suivants (offset != 0)", async () => {
      const html = new TextEncoder().encode("<html>could be partial chunk data</html>");
      // offset != 0 → pas de vérification magic bytes, relayé à Supabase
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "1000" },
      } as unknown as Response);

      const res = await tusPatch(makeTusPatchRequest(html.buffer as ArrayBuffer, "https://supabase.example/storage/v1/upload/resumable/abc", "500"));

      // Supabase est appelé (pas de rejet magic bytes)
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
