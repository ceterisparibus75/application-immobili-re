import { describe, it, expect, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import {
  requireAuthenticatedRouteContext,
  getOptionalAuthenticatedRouteContext,
} from "./api-auth";

describe("requireAuthenticatedRouteContext", () => {
  it("retourne le contexte si session valide", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });

    const result = await requireAuthenticatedRouteContext();

    expect(result).toEqual({ userId: "user-123" });
  });

  it("retourne 401 si session null", async () => {
    authMock.mockResolvedValue(null);

    const result = await requireAuthenticatedRouteContext();

    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/authentif/i);
  });

  it("retourne 401 si user.id absent", async () => {
    authMock.mockResolvedValue({ user: {} });

    const result = await requireAuthenticatedRouteContext();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});

describe("getOptionalAuthenticatedRouteContext", () => {
  it("retourne le contexte si session valide", async () => {
    authMock.mockResolvedValue({ user: { id: "user-456" } });

    const result = await getOptionalAuthenticatedRouteContext();

    expect(result).toEqual({ userId: "user-456" });
  });

  it("retourne null si session null", async () => {
    authMock.mockResolvedValue(null);

    const result = await getOptionalAuthenticatedRouteContext();
    expect(result).toBeNull();
  });

  it("retourne null si user.id absent", async () => {
    authMock.mockResolvedValue({ user: {} });

    const result = await getOptionalAuthenticatedRouteContext();
    expect(result).toBeNull();
  });
});
