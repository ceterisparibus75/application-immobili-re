import { describe, expect, it, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("bcryptjs", () => ({
  compareSync: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  createAuditLogsForUserSocieties: vi.fn().mockResolvedValue(undefined),
}));

import { compareSync } from "bcryptjs";
import { createAuditLogsForUserSocieties } from "@/lib/audit";
import {
  ACCOUNT_LOCK_DURATION_MS,
  ACCOUNT_LOCK_THRESHOLD,
  authorizeCredentials,
} from "./auth-credentials";

const compareSyncMock = vi.mocked(compareSync);
const auditMock = vi.mocked(createAuditLogsForUserSocieties);

type FakeUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  image: string | null;
  passwordHash: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  twoFactorEnabled: boolean;
  userSocieties: { societyId: string }[];
};

function buildFakeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: "user-1",
    email: "alice@example.com",
    name: "Alice",
    firstName: null,
    image: null,
    passwordHash: "$2a$10$hashed",
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    twoFactorEnabled: false,
    userSocieties: [{ societyId: "soc-1" }, { societyId: "soc-2" }],
    ...overrides,
  };
}

beforeEach(() => {
  compareSyncMock.mockReset();
  auditMock.mockClear();
  prismaMock.user.findUnique.mockReset();
  prismaMock.user.update.mockReset();
});

describe("authorizeCredentials — input validation", () => {
  it("retourne null si credentials absents", async () => {
    expect(await authorizeCredentials(undefined)).toBeNull();
    expect(await authorizeCredentials({})).toBeNull();
    expect(await authorizeCredentials({ email: "x@y.z" })).toBeNull();
    expect(await authorizeCredentials({ password: "secret" })).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("normalise l'email en lowercase pour la lookup", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildFakeUser() as never);
    compareSyncMock.mockReturnValue(true);
    prismaMock.user.update.mockResolvedValue({} as never);

    await authorizeCredentials({ email: "Alice@Example.COM", password: "pw" });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "alice@example.com" } }),
    );
  });
});

describe("authorizeCredentials — rejets silencieux", () => {
  it("retourne null si user inexistant", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await authorizeCredentials({ email: "ghost@x.com", password: "pw" });
    expect(result).toBeNull();
    expect(compareSyncMock).not.toHaveBeenCalled();
  });

  it("retourne null si user désactivé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ isActive: false }) as never,
    );
    const result = await authorizeCredentials({ email: "alice@example.com", password: "pw" });
    expect(result).toBeNull();
    expect(compareSyncMock).not.toHaveBeenCalled();
  });

  it("retourne null si compte verrouillé et lockedUntil dans le futur", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ lockedUntil: new Date(Date.now() + 60_000) }) as never,
    );
    const result = await authorizeCredentials({ email: "alice@example.com", password: "pw" });
    expect(result).toBeNull();
    expect(compareSyncMock).not.toHaveBeenCalled();
  });

  it("ne rejette PAS si lockedUntil est dans le passé (verrou expiré)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ lockedUntil: new Date(Date.now() - 60_000) }) as never,
    );
    compareSyncMock.mockReturnValue(true);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await authorizeCredentials({ email: "alice@example.com", password: "pw" });

    expect(result).not.toBeNull();
    expect(compareSyncMock).toHaveBeenCalled();
  });

  it("retourne null si DB lève une erreur", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("db down"));
    const result = await authorizeCredentials({ email: "alice@example.com", password: "pw" });
    expect(result).toBeNull();
  });
});

describe("authorizeCredentials — verrouillage compte", () => {
  it("incrémente failedLoginAttempts si mot de passe invalide", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ failedLoginAttempts: 1 }) as never,
    );
    compareSyncMock.mockReturnValue(false);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await authorizeCredentials({
      email: "alice@example.com",
      password: "wrong",
    });

    expect(result).toBeNull();
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 2 },
    });
  });

  it("verrouille le compte au 5e échec (threshold) et fixe lockedUntil à +15 min", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-11T22:00:00Z");
    vi.setSystemTime(now);

    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ failedLoginAttempts: 4 }) as never,
    );
    compareSyncMock.mockReturnValue(false);
    prismaMock.user.update.mockResolvedValue({} as never);

    await authorizeCredentials({ email: "alice@example.com", password: "wrong" });

    const call = prismaMock.user.update.mock.calls[0]?.[0];
    expect(call?.data).toEqual({
      failedLoginAttempts: ACCOUNT_LOCK_THRESHOLD,
      lockedUntil: new Date(now.getTime() + ACCOUNT_LOCK_DURATION_MS),
    });

    vi.useRealTimers();
  });

  it("écrit un audit log ACCOUNT_LOCKED au 5e échec", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ failedLoginAttempts: 4 }) as never,
    );
    compareSyncMock.mockReturnValue(false);
    prismaMock.user.update.mockResolvedValue({} as never);

    await authorizeCredentials({ email: "alice@example.com", password: "wrong" });

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN",
        entity: "User",
        societyIds: ["soc-1", "soc-2"],
        details: expect.objectContaining({
          event: "ACCOUNT_LOCKED",
          failedLoginAttempts: 5,
        }),
      }),
    );
  });

  it("écrit un audit log LOGIN_FAILED avant le seuil", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ failedLoginAttempts: 2 }) as never,
    );
    compareSyncMock.mockReturnValue(false);
    prismaMock.user.update.mockResolvedValue({} as never);

    await authorizeCredentials({ email: "alice@example.com", password: "wrong" });

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          event: "LOGIN_FAILED",
          failedLoginAttempts: 3,
        }),
      }),
    );
  });

  it("ne plante pas si l'écriture audit échoue", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildFakeUser() as never);
    compareSyncMock.mockReturnValue(false);
    prismaMock.user.update.mockRejectedValue(new Error("update fail"));

    const result = await authorizeCredentials({
      email: "alice@example.com",
      password: "wrong",
    });
    expect(result).toBeNull();
  });
});

describe("authorizeCredentials — login réussi", () => {
  it("retourne l'identité, reset les compteurs, journalise LOGIN_SUCCESS", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ failedLoginAttempts: 3 }) as never,
    );
    compareSyncMock.mockReturnValue(true);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await authorizeCredentials({
      email: "alice@example.com",
      password: "good",
    });

    expect(result).toEqual({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      image: null,
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ event: "LOGIN_SUCCESS" }),
      }),
    );
  });

  it("retourne requires2FA: true et N'écrit PAS d'audit LOGIN_SUCCESS si 2FA activée", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ twoFactorEnabled: true }) as never,
    );
    compareSyncMock.mockReturnValue(true);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await authorizeCredentials({
      email: "alice@example.com",
      password: "good",
    });

    expect(result).toEqual(
      expect.objectContaining({ id: "user-1", requires2FA: true }),
    );
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("utilise name puis firstName puis email comme fallback pour le label", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ name: null, firstName: "Alicia" }) as never,
    );
    compareSyncMock.mockReturnValue(true);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await authorizeCredentials({
      email: "alice@example.com",
      password: "good",
    });
    expect(result?.name).toBe("Alicia");

    prismaMock.user.findUnique.mockResolvedValue(
      buildFakeUser({ name: null, firstName: null }) as never,
    );
    const result2 = await authorizeCredentials({
      email: "alice@example.com",
      password: "good",
    });
    expect(result2?.name).toBe("alice@example.com");
  });

  it("ne plante pas si la mise à jour lastLoginAt échoue mais retourne l'identité", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildFakeUser() as never);
    compareSyncMock.mockReturnValue(true);
    prismaMock.user.update.mockRejectedValue(new Error("db hiccup"));

    const result = await authorizeCredentials({
      email: "alice@example.com",
      password: "good",
    });
    expect(result?.id).toBe("user-1");
  });
});
