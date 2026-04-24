import { describe, it, expect } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getEmailCopyBcc, getAllEmailCopyBcc } from "./email-copy";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

function makeUserSociety(emailCopyEnabled: boolean, email: string, emailCopyAddress: string | null = null) {
  return {
    societyId: SOCIETY_ID,
    userId: "user-1",
    role: "GESTIONNAIRE",
    user: { email, emailCopyEnabled, emailCopyAddress },
  };
}

describe("getEmailCopyBcc", () => {
  it("retourne null si aucun utilisateur n'a activé la copie", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      makeUserSociety(false, "user@example.com"),
    ] as never);

    const result = await getEmailCopyBcc(SOCIETY_ID);
    expect(result).toBeNull();
  });

  it("retourne l'email de l'utilisateur si copie activée", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      makeUserSociety(true, "admin@example.com"),
    ] as never);

    const result = await getEmailCopyBcc(SOCIETY_ID);
    expect(result).toBe("admin@example.com");
  });

  it("préfère emailCopyAddress si défini", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      makeUserSociety(true, "admin@example.com", "copies@example.com"),
    ] as never);

    const result = await getEmailCopyBcc(SOCIETY_ID);
    expect(result).toBe("copies@example.com");
  });

  it("retourne le premier email si plusieurs utilisateurs ont activé la copie", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      makeUserSociety(true, "first@example.com"),
      makeUserSociety(true, "second@example.com"),
    ] as never);

    const result = await getEmailCopyBcc(SOCIETY_ID);
    expect(result).toBe("first@example.com");
  });

  it("retourne null si aucun membership trouvé", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([] as never);
    const result = await getEmailCopyBcc(SOCIETY_ID);
    expect(result).toBeNull();
  });
});

describe("getAllEmailCopyBcc", () => {
  it("retourne toutes les adresses BCC activées", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      makeUserSociety(true, "a@example.com"),
      makeUserSociety(false, "b@example.com"),
      makeUserSociety(true, "c@example.com", "c-copy@example.com"),
    ] as never);

    const result = await getAllEmailCopyBcc(SOCIETY_ID);
    expect(result).toEqual(["a@example.com", "c-copy@example.com"]);
  });

  it("retourne un tableau vide si aucun utilisateur n'a activé", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      makeUserSociety(false, "user@example.com"),
    ] as never);

    const result = await getAllEmailCopyBcc(SOCIETY_ID);
    expect(result).toEqual([]);
  });
});
