import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: {
    AUTH_URL: "https://app.test",
    PA_AUTH_TOKEN_URL: "https://pa.test/oauth/token",
    PA_AUTH_CLIENT_ID: "cid",
    PA_AUTH_CLIENT_SECRET: "csecret",
  },
}));
vi.mock("@/lib/pa-oauth", () => ({
  storeSocietyTokens: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const STATE = "opaque-state-12345";
const USER_A = "user-a";
const USER_B = "user-b";
const SOCIETY_ID = "society-1";

function mockSession(userId: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth as any).mockResolvedValue(
    userId ? { user: { id: userId } } : null,
  );
}

function mockOAuthState(userId: string, expired = false) {
  prismaMock.pAOAuthState.findUnique.mockResolvedValue({
    id: "state-id-1",
    state: STATE,
    userId,
    societyId: SOCIETY_ID,
    codeVerifier: "verifier-xyz",
    expiresAt: expired ? new Date(Date.now() - 1000) : new Date(Date.now() + 10 * 60 * 1000),
  } as never);
}

function callCallback(state: string | null, code = "auth-code") {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  params.set("code", code);
  const url = `https://app.test/api/einvoicing/oauth/callback?${params.toString()}`;
  return GET(new NextRequest(url));
}

describe("GET /api/einvoicing/oauth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pAOAuthState.findUnique.mockResolvedValue(null);
    prismaMock.pAOAuthState.delete.mockResolvedValue({} as never);
  });

  it("redirige avec missing_params si state absent", async () => {
    mockSession(USER_A);
    const url = "https://app.test/api/einvoicing/oauth/callback?code=x";
    const r = await GET(new NextRequest(url));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("pa_error=missing_params");
  });

  it("redirige avec expired_state si l'état est introuvable", async () => {
    mockSession(USER_A);
    prismaMock.pAOAuthState.findUnique.mockResolvedValue(null);
    const r = await callCallback(STATE);
    expect(r.headers.get("location")).toContain("pa_error=expired_state");
  });

  it("redirige avec expired_state si l'état a expiré", async () => {
    mockSession(USER_A);
    mockOAuthState(USER_A, true);
    const r = await callCallback(STATE);
    expect(r.headers.get("location")).toContain("pa_error=expired_state");
  });

  it("FAILLE BLOQUÉE : refuse si l'utilisateur courant ≠ utilisateur qui a initié l'authorize", async () => {
    mockSession(USER_B); // session = user B
    mockOAuthState(USER_A); // state appartient à user A
    const r = await callCallback(STATE);
    expect(r.headers.get("location")).toContain("pa_error=user_mismatch");
    // Le state n'est PAS supprimé (laissé expirer naturellement)
    expect(prismaMock.pAOAuthState.delete).not.toHaveBeenCalled();
  });

  it("refuse si pas de session active", async () => {
    mockSession(null);
    mockOAuthState(USER_A);
    const r = await callCallback(STATE);
    expect(r.headers.get("location")).toContain("pa_error=user_mismatch");
  });

  it("accepte si session = utilisateur du state (échange OAuth lancé)", async () => {
    mockSession(USER_A);
    mockOAuthState(USER_A);

    // Mock le fetch vers le token endpoint de la PA
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "tok", refresh_token: "ref", expires_in: 3600 }),
    } as never);

    const r = await callCallback(STATE);

    // L'état doit avoir été supprimé (single-use)
    expect(prismaMock.pAOAuthState.delete).toHaveBeenCalledWith({ where: { id: "state-id-1" } });
    // Redirige vers settings avec succès
    expect(r.headers.get("location")).toContain("pa_connected=true");
  });
});
