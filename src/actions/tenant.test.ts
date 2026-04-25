import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { buildTenantPhysique } from "@/test/factories";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({
  sendPortalActivationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/env", () => ({
  env: { APP_URL: "https://app.mygestia.immo", EMAIL_FROM: "no-reply@mygestia.immo" },
}));

import {
  createTenant,
  computeTenantBalance,
  updateTenant,
  deactivateTenant,
  getTenants,
  getActiveTenants,
  getTenantById,
  createTenantContact,
  deleteTenant,
} from "./tenant";

const SOCIETY_ID = "society-1";
const TENANT_ID = "clh3x2z4k0002qh8g7z1y2v3t";
const CONTACT_ID = "clh3x2z4k0003qh8g7z1y2v3t";

beforeEach(() => {
  mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
});

// ── createTenant ──────────────────────────────────────────────────

describe("createTenant", () => {
  const validInput = {
    entityType: "PERSONNE_PHYSIQUE" as const,
    lastName: "Dupont",
    firstName: "Jean",
    email: "jean@example.com",
  };

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createTenant(SOCIETY_ID, validInput as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Non authentifié");
  });

  it("retourne une erreur si role LECTURE (insuffisant)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await createTenant(SOCIETY_ID, validInput as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Permissions insuffisantes pour cette action");
  });

  it("retourne une erreur si input invalide (email manquant)", async () => {
    const result = await createTenant(SOCIETY_ID, { ...validInput, email: "" } as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Email invalide");
  });

  it("crée le locataire et retourne son id", async () => {
    const tenant = buildTenantPhysique();
    prismaMock.tenant.create.mockResolvedValue(tenant as never);
    prismaMock.tenantPortalAccess.create.mockResolvedValue({} as never);

    const result = await createTenant(SOCIETY_ID, validInput as never);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("tenant-1");
    expect(prismaMock.tenant.create).toHaveBeenCalledOnce();
  });
});

// ── computeTenantBalance ──────────────────────────────────────────

describe("computeTenantBalance", () => {
  it("retourne 0 si aucune facture", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    const balance = await computeTenantBalance(SOCIETY_ID, TENANT_ID);
    expect(balance).toBe(0);
  });

  it("retourne le montant dû pour une facture non payée", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { totalTTC: 800, invoiceType: "APPEL_LOYER", payments: [] },
    ] as never);
    const balance = await computeTenantBalance(SOCIETY_ID, TENANT_ID);
    expect(balance).toBe(800);
  });

  it("soustrait les paiements déjà effectués", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { totalTTC: 800, invoiceType: "APPEL_LOYER", payments: [{ amount: 500 }] },
    ] as never);
    const balance = await computeTenantBalance(SOCIETY_ID, TENANT_ID);
    expect(balance).toBe(300);
  });

  it("réduit le solde pour un avoir", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { totalTTC: 800, invoiceType: "APPEL_LOYER", payments: [] },
      { totalTTC: 200, invoiceType: "AVOIR", payments: [] },
    ] as never);
    const balance = await computeTenantBalance(SOCIETY_ID, TENANT_ID);
    expect(balance).toBe(600);
  });

  it("retourne 0 si toutes les factures sont entièrement payées", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { totalTTC: 800, invoiceType: "APPEL_LOYER", payments: [{ amount: 800 }] },
    ] as never);
    const balance = await computeTenantBalance(SOCIETY_ID, TENANT_ID);
    expect(balance).toBe(0);
  });
});

// ── updateTenant ──────────────────────────────────────────────────

describe("updateTenant", () => {
  const validInput = {
    id: TENANT_ID,
    entityType: "PERSONNE_PHYSIQUE" as const,
    email: "nouveau@example.com",
  };

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateTenant(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const result = await updateTenant(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("met à jour le locataire avec succès", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.tenant.update.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: TENANT_ID,
      entityType: "PERSONNE_PHYSIQUE",
      firstName: "Jean",
      lastName: "Dupont",
      email: "nouveau@example.com",
      phone: null,
      mobile: null,
      companyName: null,
      legalRepName: null,
    } as never);
    prismaMock.contact.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateTenant(SOCIETY_ID, validInput);
    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledOnce();
  });
});

// ── deactivateTenant ──────────────────────────────────────────────

describe("deactivateTenant", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deactivateTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
  });

  it("bloque si le locataire a des baux actifs", async () => {
    prismaMock.lease.count.mockResolvedValue(2);
    const result = await deactivateTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("2 bail");
  });

  it("désactive le locataire si aucun bail actif", async () => {
    prismaMock.lease.count.mockResolvedValue(0);
    prismaMock.tenant.update.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.contact.updateMany.mockResolvedValue({ count: 0 });

    const result = await deactivateTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });
});

// ── getTenants ────────────────────────────────────────────────────

describe("getTenants", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getTenants(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne la liste des locataires", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([{ id: TENANT_ID }] as never);
    const result = await getTenants(SOCIETY_ID);
    expect(result).toHaveLength(1);
  });
});

// ── getActiveTenants ──────────────────────────────────────────────

describe("getActiveTenants", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getActiveTenants(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne uniquement les locataires actifs", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([{ id: TENANT_ID }] as never);
    const result = await getActiveTenants(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
  });
});

// ── getTenantById ─────────────────────────────────────────────────

describe("getTenantById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getTenantById(SOCIETY_ID, TENANT_ID);
    expect(result).toBeNull();
  });

  it("retourne le locataire si trouvé", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    const result = await getTenantById(SOCIETY_ID, TENANT_ID);
    expect(result?.id).toBe(TENANT_ID);
  });
});

// ── createTenantContact ───────────────────────────────────────────

describe("createTenantContact", () => {
  const contactInput = { name: "Marie Dupont", role: "Conjoint", email: "marie@example.com", phone: null };

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createTenantContact(SOCIETY_ID, TENANT_ID, contactInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const result = await createTenantContact(SOCIETY_ID, TENANT_ID, contactInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("crée un contact avec succès", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.tenantContact.create.mockResolvedValue({ id: CONTACT_ID, name: "Marie Dupont" } as never);

    const result = await createTenantContact(SOCIETY_ID, TENANT_ID, contactInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(CONTACT_ID);
  });
});

// ── deleteTenant ──────────────────────────────────────────────────

describe("deleteTenant", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const result = await deleteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("bloque la suppression si un bail actif existe", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: TENANT_ID,
      firstName: "Jean",
      lastName: "Dupont",
      companyName: null,
      leases: [{ id: "lease-1" }],
    } as never);

    const result = await deleteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("bail actif");
  });

  it("supprime le locataire si aucun bail actif", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: TENANT_ID,
      firstName: "Jean",
      lastName: "Dupont",
      companyName: null,
      leases: [],
    } as never);
    prismaMock.$transaction.mockResolvedValue([]);

    const result = await deleteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
