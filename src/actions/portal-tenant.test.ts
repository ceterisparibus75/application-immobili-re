import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { requirePortalAuth } = vi.hoisted(() => ({
  requirePortalAuth: vi.fn(),
}));
vi.mock("@/lib/portal-auth", () => ({ requirePortalAuth }));

import { updatePortalTenantContact } from "./portal-tenant";
import { createAuditLog } from "@/lib/audit";

describe("updatePortalTenantContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePortalAuth.mockResolvedValue({ tenantId: "tenant-1", email: "tenant@test.fr" });
  });

  it("retourne une erreur si la session portail est invalide", async () => {
    requirePortalAuth.mockRejectedValue(new Error("Acces non autorise"));

    const result = await updatePortalTenantContact({ phone: "0600000000" });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur si le locataire n'existe pas pour cette session", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);

    const result = await updatePortalTenantContact({ phone: "0600000000" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("met a jour le telephone du locataire", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1", societyId: "soc-1" } as never);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    const result = await updatePortalTenantContact({ phone: "0612345678" });

    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tenant-1" },
        data: expect.objectContaining({ phone: "0612345678" }),
      })
    );
  });

  it("met a jour le mobile du locataire", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1", societyId: "soc-1" } as never);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    const result = await updatePortalTenantContact({ mobile: "0687654321" });

    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mobile: "0687654321" }),
      })
    );
  });

  it("rejette un email invalide", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1", societyId: "soc-1" } as never);

    const result = await updatePortalTenantContact({ email: "pas-un-email" });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
  });

  it("rejette si aucun champ fourni", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1", societyId: "soc-1" } as never);

    const result = await updatePortalTenantContact({});

    expect(result.success).toBe(false);
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
  });

  it("cree un audit log apres mise a jour", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1", societyId: "soc-1" } as never);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await updatePortalTenantContact({ phone: "0612345678" });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "Tenant",
        entityId: "tenant-1",
      })
    );
  });

  it("ne met pas a jour l'email si egal a l'email de session (securite)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1", societyId: "soc-1" } as never);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    const result = await updatePortalTenantContact({ email: "tenant@test.fr", phone: "0600000000" });

    expect(result.success).toBe(true);
    // L'email de session ne doit pas etre modifie (evite de se bloquer hors du portail)
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ email: expect.anything() }),
      })
    );
  });
});
