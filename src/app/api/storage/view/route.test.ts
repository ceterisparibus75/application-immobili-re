import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRouteContext: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    SUPABASE_STORAGE_BUCKET: "documents",
  },
}));

const { createClient } = vi.hoisted(() => {
  // Simule un fichier introuvable côté Supabase — on teste seulement l'ACL.
  const downloadFn = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
  const createSignedUrlFn = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
  const fromFn = vi.fn(() => ({ download: downloadFn, createSignedUrl: createSignedUrlFn }));
  return {
    createClient: vi.fn(() => ({ storage: { from: fromFn } })),
  };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { requireAuthenticatedRouteContext } from "@/lib/api-auth";
import { GET } from "./route";

const USER_A = "user-a";

function mockAuth() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(requireAuthenticatedRouteContext as any).mockResolvedValue({ userId: USER_A });
}

function callGet(path: string) {
  return GET(new NextRequest(`http://localhost/api/storage/view?path=${encodeURIComponent(path)}`));
}

describe("GET /api/storage/view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.userSociety.findUnique.mockResolvedValue(null);
  });

  it("refuse path inconnu (rootFolder non whitelisté)", async () => {
    const r = await callGet("secret/malicious.txt");
    expect(r.status).toBe(403);
  });

  it("refuse les chemins de moins de 2 segments", async () => {
    const r = await callGet("documents");
    expect(r.status).toBe(403);
  });

  it("refuse path traversal (résolu en path inconnu, donc 403 via whitelist)", async () => {
    // documents/../secret/x → normalize → secret/x → rootFolder "secret" non whitelisté
    const r = await callGet("documents/../secret/x");
    expect([400, 403]).toContain(r.status);
  });

  it("refuse les chemins absolus (le `/` initial est nettoyé, mais le rootFolder n'est pas whitelisté)", async () => {
    const r = await callGet("/etc/passwd");
    // Le sanitizer enlève le `/` initial → `etc/passwd`. rootFolder "etc" non whitelisté → 403.
    expect([400, 403]).toContain(r.status);
  });

  it("autorise documents/<societyId>/file.pdf si l'utilisateur a accès", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: USER_A, proprietaire: null } as never);
    // Le download Supabase est mocké pour retourner une erreur (on teste juste l'auth)
    const r = await callGet("documents/society-1/file.pdf");
    // Devrait passer le check ACL et tenter le download. On accepte 404 (file not found) ou autre, mais pas 403.
    expect(r.status).not.toBe(403);
  });

  it("refuse documents/<societyId>/file.pdf si l'utilisateur n'a pas accès", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "other", proprietaire: null } as never);
    prismaMock.userSociety.findUnique.mockResolvedValue(null);
    const r = await callGet("documents/society-1/file.pdf");
    expect(r.status).toBe(403);
  });

  it("autorise temp/<userId>/file pour son propre userId", async () => {
    const r = await callGet(`temp/${USER_A}/upload.pdf`);
    expect(r.status).not.toBe(403);
  });
});
