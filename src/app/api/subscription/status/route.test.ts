import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/api-auth", () => ({
  getOptionalAuthenticatedRouteContext: vi.fn(),
}));
vi.mock("@/lib/plan-limits", () => ({
  checkSubscriptionActive: vi.fn(),
}));

import { getOptionalAuthenticatedRouteContext } from "@/lib/api-auth";
import { checkSubscriptionActive } from "@/lib/plan-limits";

import { GET } from "./route";

const SOCIETY_ID = "society-1";
const USER_A = "user-a";

function mockSession(userId: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getOptionalAuthenticatedRouteContext as any).mockResolvedValue(
    userId ? { userId } : null,
  );
}

function callGet(societyId: string | null) {
  const url = societyId
    ? `http://localhost/api/subscription/status?societyId=${societyId}`
    : "http://localhost/api/subscription/status";
  return GET(new NextRequest(url));
}

describe("GET /api/subscription/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.userSociety.findUnique.mockResolvedValue(null);
  });

  it("retourne neutre si pas authentifié", async () => {
    mockSession(null);
    const r = await callGet(SOCIETY_ID);
    const body = await r.json();
    expect(body).toEqual({ type: null, message: "" });
  });

  it("retourne neutre si pas de societyId", async () => {
    mockSession(USER_A);
    const r = await callGet(null);
    const body = await r.json();
    expect(body).toEqual({ type: null, message: "" });
  });

  it("ne fuite PAS d'info si l'utilisateur n'a pas accès à la société (réponse neutre)", async () => {
    mockSession(USER_A);
    // requireSocietyAccess va throw ForbiddenError car ni ownerId ni membership
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "other-user", proprietaire: null } as never);
    prismaMock.userSociety.findUnique.mockResolvedValue(null);

    const r = await callGet(SOCIETY_ID);
    const body = await r.json();
    expect(body).toEqual({ type: null, message: "" });
    // checkSubscriptionActive ne doit pas avoir été appelée
    expect(checkSubscriptionActive).not.toHaveBeenCalled();
  });

  it("retourne le statut quand l'utilisateur est propriétaire de la société", async () => {
    mockSession(USER_A);
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: USER_A, proprietaire: null } as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (checkSubscriptionActive as any).mockResolvedValue({
      active: true,
      status: "TRIALING",
      daysLeft: 3,
    });

    const r = await callGet(SOCIETY_ID);
    const body = await r.json();
    expect(body.type).toBe("trial_warning");
    expect(body.daysLeft).toBe(3);
  });
});
