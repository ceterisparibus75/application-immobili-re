import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { buildTenantPhysique } from "@/test/factories";
import { UserRole } from "@/generated/prisma/client";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { getOptionalAccessibleActiveSocietyId } from "@/lib/active-society";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({
  sendPortalActivationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/env", () => ({
  env: { APP_URL: "https://app.mygestia.immo", EMAIL_FROM: "no-reply@mygestia.immo", AUTH_URL: "https://app.test" },
}));
vi.mock("bcryptjs", () => ({ hash: vi.fn().mockResolvedValue("hashed-activation-code") }));
vi.mock("@/lib/active-society", () => ({
  getOptionalAccessibleActiveSocietyId: vi.fn().mockResolvedValue("society-1"),
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
  getTenantsPaginated,
  getTenantAccountStatement,
  updateTenantContact,
  deleteTenantContact,
  inviteOrReinviteTenant,
  syncTenantsToContacts,
  createManualDebit,
  getTenantsForSelect,
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

// ── getTenantsPaginated ───────────────────────────────────────────

describe("getTenantsPaginated", () => {
  it("retourne { data: [], total: 0 } si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getTenantsPaginated(SOCIETY_ID);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it("retourne les locataires paginés avec leur solde", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: TENANT_ID, companyName: null, firstName: "Jean", lastName: "Dupont" },
    ] as never);
    prismaMock.tenant.count.mockResolvedValue(1 as never);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const result = await getTenantsPaginated(SOCIETY_ID, { page: 1, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: TENANT_ID, balance: 0 });
  });

  it("applique le filtre de recherche", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([]);
    prismaMock.tenant.count.mockResolvedValue(0 as never);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    await getTenantsPaginated(SOCIETY_ID, { search: "Dupont" });
    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.anything() }) })
    );
  });

  it("applique le filtre statut actif", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([]);
    prismaMock.tenant.count.mockResolvedValue(0 as never);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    await getTenantsPaginated(SOCIETY_ID, { filters: { status: "active" } });
    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
  });
});

// ── getTenantAccountStatement ─────────────────────────────────────

describe("getTenantAccountStatement", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getTenantAccountStatement(SOCIETY_ID, TENANT_ID);
    expect(result).toBeNull();
  });

  it("calcule le solde correctement", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "FAC-2025-0001",
        invoiceType: "APPEL_LOYER",
        status: "VALIDEE",
        issueDate: new Date(),
        dueDate: new Date(),
        periodStart: null,
        periodEnd: null,
        totalHT: 800,
        totalVAT: 0,
        totalTTC: 800,
        payments: [{ id: "pay-1", amount: 200, paidAt: new Date(), method: "VIREMENT", reference: null }],
      },
      {
        id: "inv-2",
        invoiceNumber: "FAC-2025-0002",
        invoiceType: "AVOIR",
        status: "VALIDEE",
        issueDate: new Date(),
        dueDate: new Date(),
        periodStart: null,
        periodEnd: null,
        totalHT: 100,
        totalVAT: 0,
        totalTTC: 100,
        payments: [],
      },
    ] as never);

    const result = await getTenantAccountStatement(SOCIETY_ID, TENANT_ID);
    expect(result).not.toBeNull();
    expect(result?.balance).toBe(500); // 800 - 200 (paiement) - 100 (avoir)
  });

  it("ignore les factures annulées et les brouillons", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      { totalTTC: 800, invoiceType: "APPEL_LOYER", status: "ANNULEE", payments: [] },
      { totalTTC: 500, invoiceType: "APPEL_LOYER", status: "BROUILLON", payments: [] },
    ] as never);

    const result = await getTenantAccountStatement(SOCIETY_ID, TENANT_ID);
    expect(result?.balance).toBe(0);
  });
});

// ── updateTenantContact ───────────────────────────────────────────

describe("updateTenantContact", () => {
  const contactInput = { name: "Marie Dupont", role: "Conjoint", email: "marie@example.com", phone: null };

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateTenantContact(SOCIETY_ID, CONTACT_ID, contactInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le contact est introuvable", async () => {
    prismaMock.tenantContact.findFirst.mockResolvedValue(null);
    const result = await updateTenantContact(SOCIETY_ID, CONTACT_ID, contactInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("met à jour le contact avec succès", async () => {
    prismaMock.tenantContact.findFirst.mockResolvedValue({
      id: CONTACT_ID, tenantId: TENANT_ID, name: "Ancienne Marie",
    } as never);
    prismaMock.tenantContact.update.mockResolvedValue({ id: CONTACT_ID } as never);

    const result = await updateTenantContact(SOCIETY_ID, CONTACT_ID, contactInput);
    expect(result.success).toBe(true);
    expect(prismaMock.tenantContact.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONTACT_ID } })
    );
  });
});

// ── deleteTenantContact ───────────────────────────────────────────

describe("deleteTenantContact", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteTenantContact(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le contact est introuvable", async () => {
    prismaMock.tenantContact.findFirst.mockResolvedValue(null);
    const result = await deleteTenantContact(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("supprime le contact avec succès", async () => {
    prismaMock.tenantContact.findFirst.mockResolvedValue({
      id: CONTACT_ID, tenantId: TENANT_ID,
    } as never);
    prismaMock.tenantContact.delete.mockResolvedValue({ id: CONTACT_ID } as never);

    const result = await deleteTenantContact(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.tenantContact.delete).toHaveBeenCalledWith({ where: { id: CONTACT_ID } });
  });
});

// ── inviteOrReinviteTenant ────────────────────────────────────────

describe("inviteOrReinviteTenant", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await inviteOrReinviteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const result = await inviteOrReinviteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("envoie l'invitation et crée/met à jour l'accès portail", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: TENANT_ID,
      entityType: "PERSONNE_PHYSIQUE",
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean@example.com",
      companyName: null,
    } as never);
    prismaMock.tenantPortalAccess.upsert.mockResolvedValue({} as never);

    const result = await inviteOrReinviteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.tenantPortalAccess.upsert).toHaveBeenCalledOnce();
  });

  it("utilise companyName pour une personne morale", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: TENANT_ID,
      entityType: "PERSONNE_MORALE",
      firstName: null,
      lastName: null,
      email: "contact@acme.com",
      companyName: "ACME SARL",
    } as never);
    prismaMock.tenantPortalAccess.upsert.mockResolvedValue({} as never);

    const result = await inviteOrReinviteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(true);
  });
});

// ── syncTenantsToContacts ─────────────────────────────────────────

describe("syncTenantsToContacts", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await syncTenantsToContacts(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne { created: 0, updated: 0 } si aucun locataire", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([] as never);
    const result = await syncTenantsToContacts(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ created: 0, updated: 0 });
  });

  it("crée un contact si aucun contact existant", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE",
        firstName: "Jean", lastName: "Dupont",
        email: "jean@example.com", phone: null, mobile: null, isActive: true,
        companyName: null, legalRepName: null,
        contact: null,
      },
    ] as never);
    prismaMock.contact.create.mockResolvedValue({ id: "contact-new" } as never);

    const result = await syncTenantsToContacts(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ created: 1, updated: 0 });
    expect(prismaMock.contact.create).toHaveBeenCalledOnce();
  });

  it("met à jour un contact existant", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE",
        firstName: "Jean", lastName: "Dupont",
        email: "jean@example.com", phone: null, mobile: null, isActive: true,
        companyName: null, legalRepName: null,
        contact: { id: "contact-existing" },
      },
    ] as never);
    prismaMock.contact.update.mockResolvedValue({ id: "contact-existing" } as never);

    const result = await syncTenantsToContacts(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ created: 0, updated: 1 });
    expect(prismaMock.contact.update).toHaveBeenCalledOnce();
  });
});

// ── createManualDebit ─────────────────────────────────────────────

const INVOICE_ID = "clh3x2z4k0004qh8g7z1y2v3t";
const validDebitInput = {
  tenantId: TENANT_ID,
  label: "Reprise de solde",
  amount: 500,
  dueDate: "2025-06-01",
  vatRate: 0,
};

describe("createManualDebit", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le montant est invalide", async () => {
    const result = await createManualDebit(SOCIETY_ID, { ...validDebitInput, amount: -100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("positif");
  });

  it("retourne une erreur si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("crée la facture manuelle avec succès", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(INVOICE_ID);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});


// --- computeTenantBalances via getTenantsPaginated (lignes 89-100) ---

describe("getTenantsPaginated — computeTenantBalances avec AVOIR", () => {
  it("calcule le solde en batch avec AVOIR (lignes 89-100)", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: TENANT_ID, companyName: null, firstName: "Jean", lastName: "Dupont" },
    ] as never);
    prismaMock.tenant.count.mockResolvedValue(1 as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: "inv-1", tenantId: TENANT_ID, totalTTC: 800, invoiceType: "APPEL_LOYER" },
      { id: "inv-2", tenantId: TENANT_ID, totalTTC: 200, invoiceType: "AVOIR" },
    ] as never);
    prismaMock.payment.groupBy.mockResolvedValue([
      { invoiceId: "inv-1", _sum: { amount: 100 } },
    ] as never);

    const result = await getTenantsPaginated(SOCIETY_ID, { page: 1, pageSize: 10 });
    expect(result.data[0].balance).toBe(500); // 800 - 100 payment - 200 avoir = 500
  });
});

// --- createTenant — subscription inactive (ligne 123) ---

describe("createTenant — subscription inactive (ligne 123)", () => {
  it("retourne une erreur si abonnement inactif", async () => {
    vi.mocked(checkSubscriptionActive).mockResolvedValueOnce({ active: false, message: "Abonnement expire" } as never);
    const result = await createTenant(SOCIETY_ID, { entityType: "PERSONNE_PHYSIQUE", lastName: "D", firstName: "J", email: "j@e.fr" } as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Abonnement expire");
  });
});

// --- createTenant — email error callback (ligne 231) ---

describe("createTenant — email error callback (ligne 231)", () => {
  it("continue apres echec envoi email (ligne 231)", async () => {
    const { sendPortalActivationEmail } = await import("@/lib/email");
    vi.mocked(sendPortalActivationEmail).mockRejectedValueOnce(new Error("SMTP error"));
    prismaMock.tenant.create.mockResolvedValue({
      id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE", firstName: "J", lastName: "D",
      email: "j@e.fr", companyName: null, phone: null, mobile: null, legalRepName: null,
    } as never);
    prismaMock.contact.create.mockResolvedValue({} as never);
    prismaMock.tenantPortalAccess.create.mockResolvedValue({} as never);

    const result = await createTenant(SOCIETY_ID, { entityType: "PERSONNE_PHYSIQUE", lastName: "D", firstName: "J", email: "j@e.fr" } as never);
    expect(result.success).toBe(true);
  });
});

// --- createTenant — erreur generique BDD (lignes 241-242) ---

describe("createTenant — erreur generique BDD (lignes 241-242)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenant.create.mockRejectedValue(new Error("DB error"));
    const result = await createTenant(SOCIETY_ID, { entityType: "PERSONNE_PHYSIQUE", lastName: "D", firstName: "J", email: "j@e.fr" } as never);
    expect(result.success).toBe(false);
    expect(result.error).toContain("locataire");
  });
});

// --- updateTenant — Zod error (lignes 255,257) ---

describe("updateTenant — Zod error (lignes 255,257)", () => {
  it("retourne une erreur Zod si id invalide", async () => {
    const result = await updateTenant(SOCIETY_ID, { id: "invalid-not-cuid", entityType: "PERSONNE_PHYSIQUE" as const } as never);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// --- updateTenant — birthDate (ligne 275) ---

describe("updateTenant — birthDate (ligne 275)", () => {
  it("gere la mise a jour de birthDate", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.tenant.update.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE", firstName: "J", lastName: "D",
      email: "j@e.fr", phone: null, mobile: null, companyName: null, legalRepName: null,
    } as never);
    prismaMock.contact.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateTenant(SOCIETY_ID, { id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE" as const, email: "j@e.fr", birthDate: "1990-01-01" } as never);
    expect(result.success).toBe(true);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ birthDate: expect.any(Date) }) })
    );
  });
});

// --- updateTenant — ForbiddenError (lignes 316-317) ---

describe("updateTenant — ForbiddenError (lignes 316-317)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await updateTenant(SOCIETY_ID, { id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE" as const, email: "j@e.fr" } as never);
    expect(result.success).toBe(false);
  });
});

// --- updateTenant — erreur generique BDD (lignes 319-320) ---

describe("updateTenant — erreur generique BDD (lignes 319-320)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await updateTenant(SOCIETY_ID, { id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE" as const, email: "j@e.fr" } as never);
    expect(result.success).toBe(false);
    expect(result.error).toContain("jour");
  });
});

// --- deactivateTenant — ForbiddenError (lignes 368-369) ---

describe("deactivateTenant — ForbiddenError (lignes 368-369)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await deactivateTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
  });
});

// --- deactivateTenant — erreur generique BDD (lignes 371-372) ---

describe("deactivateTenant — erreur generique BDD (lignes 371-372)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.lease.count.mockRejectedValue(new Error("DB error"));
    const result = await deactivateTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("sactivation");
  });
});

// --- getTenantsPaginated — filtres supplementaires ---

describe("getTenantsPaginated — filtres supplementaires", () => {
  beforeEach(() => {
    prismaMock.tenant.findMany.mockResolvedValue([]);
    prismaMock.tenant.count.mockResolvedValue(0 as never);
    prismaMock.invoice.findMany.mockResolvedValue([]);
  });

  it("applique le filtre statut inactif (ligne 408)", async () => {
    await getTenantsPaginated(SOCIETY_ID, { filters: { status: "inactive" } });
    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: false }) })
    );
  });

  it("applique le filtre entityType (ligne 410)", async () => {
    await getTenantsPaginated(SOCIETY_ID, { filters: { entityType: "PERSONNE_MORALE" } });
    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ entityType: "PERSONNE_MORALE" }) })
    );
  });

  it("applique un tri personnalise (ligne 416)", async () => {
    await getTenantsPaginated(SOCIETY_ID, { sortBy: "email", sortOrder: "desc" });
    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ email: "desc" }] })
    );
  });
});

// --- getTenantAccountStatement — QUITTANCE (ligne 579) ---

describe("getTenantAccountStatement — QUITTANCE (ligne 579)", () => {
  it("exclut les QUITTANCE du calcul de solde (ligne 579)", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-q", invoiceNumber: "QUI-001", invoiceType: "QUITTANCE", status: "VALIDEE",
        issueDate: new Date(), dueDate: new Date(), periodStart: null, periodEnd: null,
        totalHT: 800, totalVAT: 0, totalTTC: 800, payments: [],
      },
      {
        id: "inv-1", invoiceNumber: "FAC-001", invoiceType: "APPEL_LOYER", status: "VALIDEE",
        issueDate: new Date(), dueDate: new Date(), periodStart: null, periodEnd: null,
        totalHT: 300, totalVAT: 0, totalTTC: 300, payments: [],
      },
    ] as never);

    const result = await getTenantAccountStatement(SOCIETY_ID, TENANT_ID);
    expect(result?.balance).toBe(300);
  });
});

// --- createTenantContact — Zod error (ligne 604) ---

describe("createTenantContact — Zod error (ligne 604)", () => {
  it("retourne une erreur si le nom est vide", async () => {
    const result = await createTenantContact(SOCIETY_ID, TENANT_ID, { name: "", email: "a@a.fr", role: null, phone: null });
    expect(result.success).toBe(false);
    expect(result.error).toContain("nom");
  });
});

// --- createTenantContact — ForbiddenError (ligne 627) ---

describe("createTenantContact — ForbiddenError (ligne 627)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await createTenantContact(SOCIETY_ID, TENANT_ID, { name: "Marie", email: null, role: null, phone: null });
    expect(result.success).toBe(false);
  });
});

// --- createTenantContact — erreur generique BDD (lignes 628-629) ---

describe("createTenantContact — erreur generique BDD (lignes 628-629)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await createTenantContact(SOCIETY_ID, TENANT_ID, { name: "Marie", email: null, role: null, phone: null });
    expect(result.success).toBe(false);
    expect(result.error).toContain("contact");
  });
});

// --- updateTenantContact — Zod error (ligne 643) ---

describe("updateTenantContact — Zod error (ligne 643)", () => {
  it("retourne une erreur si le nom est vide", async () => {
    const result = await updateTenantContact(SOCIETY_ID, CONTACT_ID, { name: "", email: "a@a.fr", role: null, phone: null });
    expect(result.success).toBe(false);
    expect(result.error).toContain("nom");
  });
});

// --- updateTenantContact — ForbiddenError (ligne 666) ---

describe("updateTenantContact — ForbiddenError (ligne 666)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await updateTenantContact(SOCIETY_ID, CONTACT_ID, { name: "Marie", email: null, role: null, phone: null });
    expect(result.success).toBe(false);
  });
});

// --- updateTenantContact — erreur generique BDD (lignes 667-668) ---

describe("updateTenantContact — erreur generique BDD (lignes 667-668)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenantContact.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await updateTenantContact(SOCIETY_ID, CONTACT_ID, { name: "Marie", email: null, role: null, phone: null });
    expect(result.success).toBe(false);
    expect(result.error).toContain("contact");
  });
});

// --- deleteTenant — ForbiddenError (ligne 715) ---

describe("deleteTenant — ForbiddenError (ligne 715)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await deleteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
  });
});

// --- deleteTenant — erreur generique BDD (lignes 716-717) ---

describe("deleteTenant — erreur generique BDD (lignes 716-717)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await deleteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("suppression");
  });
});

// --- deleteTenantContact — ForbiddenError (ligne 748) ---

describe("deleteTenantContact — ForbiddenError (ligne 748)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await deleteTenantContact(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
  });
});

// --- deleteTenantContact — erreur generique BDD (lignes 749-750) ---

describe("deleteTenantContact — erreur generique BDD (lignes 749-750)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenantContact.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await deleteTenantContact(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("contact");
  });
});

// --- inviteOrReinviteTenant — ForbiddenError (ligne 811) ---

describe("inviteOrReinviteTenant — ForbiddenError (ligne 811)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await inviteOrReinviteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
  });
});

// --- inviteOrReinviteTenant — erreur generique BDD (lignes 812-813) ---

describe("inviteOrReinviteTenant — erreur generique BDD (lignes 812-813)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await inviteOrReinviteTenant(SOCIETY_ID, TENANT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("invitation");
  });
});

// --- syncTenantsToContacts — ForbiddenError (ligne 878) ---

describe("syncTenantsToContacts — ForbiddenError (ligne 878)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await syncTenantsToContacts(SOCIETY_ID);
    expect(result.success).toBe(false);
  });
});

// --- syncTenantsToContacts — erreur generique BDD (lignes 879-880) ---

describe("syncTenantsToContacts — erreur generique BDD (lignes 879-880)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenant.findMany.mockRejectedValue(new Error("DB error"));
    const result = await syncTenantsToContacts(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("synchronisation");
  });
});

// --- getTenantsForSelect (lignes 889-901) ---

describe("getTenantsForSelect", () => {
  it("retourne un tableau vide si non authentifie", async () => {
    mockUnauthenticated();
    const result = await getTenantsForSelect();
    expect(result).toEqual([]);
  });

  it("retourne un tableau vide si aucune societe active (ligne 893)", async () => {
    vi.mocked(getOptionalAccessibleActiveSocietyId).mockResolvedValueOnce(null);
    const result = await getTenantsForSelect();
    expect(result).toEqual([]);
  });

  it("retourne la liste des locataires avec nom formate", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: TENANT_ID, entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Dupont", companyName: null },
      { id: "tid-2", entityType: "PERSONNE_MORALE", firstName: null, lastName: null, companyName: "ACME" },
      { id: "tid-3", entityType: "PERSONNE_PHYSIQUE", firstName: null, lastName: null, companyName: null },
    ] as never);

    const result = await getTenantsForSelect();
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Jean Dupont");
    expect(result[1].name).toBe("ACME");
    expect(result[2].name).toBe("—");
  });
});

// --- createManualDebit — subscription inactive (ligne 934) ---

describe("createManualDebit — subscription inactive (ligne 934)", () => {
  it("retourne une erreur si abonnement inactif (ligne 934)", async () => {
    vi.mocked(checkSubscriptionActive).mockResolvedValueOnce({ active: false, message: "Abonnement expire" } as never);
    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Abonnement expire");
  });
});

// --- createManualDebit — transaction callback (lignes 958-976) ---

describe("createManualDebit — transaction callback (lignes 958-976)", () => {
  it("execute le callback avec annee courante (yearChanged=false)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(prismaMock));
    const currentYear = new Date().getFullYear();
    prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: currentYear, nextInvoiceNumber: 5, invoicePrefix: "FAC" } as never);
    prismaMock.society.update.mockResolvedValue({ invoicePrefix: "FAC", nextInvoiceNumber: 6 } as never);
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(INVOICE_ID);
  });

  it("execute le callback avec annee precedente (yearChanged=true, prefix null)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(prismaMock));
    prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2020, nextInvoiceNumber: 99, invoicePrefix: null } as never);
    prismaMock.society.update.mockResolvedValue({ invoicePrefix: null, nextInvoiceNumber: 2 } as never);
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(true);
  });
});

// --- createManualDebit — ForbiddenError (ligne 1026) ---

describe("createManualDebit — ForbiddenError (ligne 1026)", () => {
  it("retourne une erreur si role insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(false);
  });
});

// --- createManualDebit — erreur generique BDD (lignes 1027-1028) ---

describe("createManualDebit — erreur generique BDD (lignes 1027-1028)", () => {
  it("retourne une erreur generique si la BDD echoue", async () => {
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await createManualDebit(SOCIETY_ID, validDebitInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("somme due");
  });
});

