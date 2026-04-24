import { describe, it, expect, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import {
  requireAuthenticatedActionContext,
  getOptionalAuthenticatedActionContext,
} from "./action-auth";
import { UnauthenticatedActionError } from "./action-society";

describe("requireAuthenticatedActionContext", () => {
  it("retourne le contexte si session valide", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });

    const ctx = await requireAuthenticatedActionContext();

    expect(ctx.userId).toBe("user-123");
    expect(ctx.session.user.id).toBe("user-123");
  });

  it("lève UnauthenticatedActionError si session null", async () => {
    authMock.mockResolvedValue(null);

    await expect(requireAuthenticatedActionContext()).rejects.toThrow(UnauthenticatedActionError);
  });

  it("lève UnauthenticatedActionError si user.id absent", async () => {
    authMock.mockResolvedValue({ user: {} });

    await expect(requireAuthenticatedActionContext()).rejects.toThrow(UnauthenticatedActionError);
  });
});

describe("getOptionalAuthenticatedActionContext", () => {
  it("retourne le contexte si session valide", async () => {
    authMock.mockResolvedValue({ user: { id: "user-456" } });

    const ctx = await getOptionalAuthenticatedActionContext();

    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe("user-456");
  });

  it("retourne null si session null", async () => {
    authMock.mockResolvedValue(null);

    const ctx = await getOptionalAuthenticatedActionContext();
    expect(ctx).toBeNull();
  });

  it("retourne null si user.id absent", async () => {
    authMock.mockResolvedValue({ user: {} });

    const ctx = await getOptionalAuthenticatedActionContext();
    expect(ctx).toBeNull();
  });
});
