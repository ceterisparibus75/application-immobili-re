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

const baseTenantData = {
  id: "tenant-1",
  societyId: "soc-1",
  entityType: "PERSONNE_PHYSIQUE",
  phone: "0100000000",
  mobile: "0600000000",
  personalAddress: "Ancienne adresse",
  companyAddress: null,
};
const baseTenant = baseTenantData as never;

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
    prismaMock.tenant.findFirst.mockResolvedValue(baseTenant);
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
    prismaMock.tenant.findFirst.mockResolvedValue(baseTenant);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    const result = await updatePortalTenantContact({ mobile: "0687654321" });

    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mobile: "0687654321" }),
      })
    );
  });

  it("rejette si aucun champ fourni", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(baseTenant);

    const result = await updatePortalTenantContact({});

    expect(result.success).toBe(false);
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
  });

  it("cree un audit log avec before/after et source portal_locataire", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(baseTenant);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await updatePortalTenantContact({ phone: "0612345678" });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "Tenant",
        entityId: "tenant-1",
        details: expect.objectContaining({
          event: "PORTAL_TENANT_CONTACT_UPDATE",
          source: "portal_locataire",
          before: expect.objectContaining({ phone: "0100000000" }),
          after: expect.objectContaining({ phone: "0612345678" }),
        }),
      })
    );
  });

  it("met a jour personalAddress pour PERSONNE_PHYSIQUE", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(baseTenant);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    const result = await updatePortalTenantContact({ address: "12 rue de la Paix\n75001 Paris" });

    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ personalAddress: "12 rue de la Paix\n75001 Paris" }),
      })
    );
  });

  it("met a jour companyAddress pour PERSONNE_MORALE", async () => {
    const moralTenant = { ...baseTenantData, entityType: "PERSONNE_MORALE", companyAddress: "Ancienne adresse societe", personalAddress: null } as never;
    prismaMock.tenant.findFirst.mockResolvedValue(moralTenant);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    const result = await updatePortalTenantContact({ address: "10 avenue de l'Opera\n75001 Paris" });

    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyAddress: "10 avenue de l'Opera\n75001 Paris" }),
      })
    );
  });

  it("log contient l'ancienne et la nouvelle adresse", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(baseTenant);
    prismaMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await updatePortalTenantContact({ address: "Nouvelle adresse" });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          before: expect.objectContaining({ address: "Ancienne adresse" }),
          after: expect.objectContaining({ address: "Nouvelle adresse" }),
        }),
      })
    );
  });
});
