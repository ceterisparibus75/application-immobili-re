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
  env: { APP_URL: "https://app.mygestia.immo", EMAIL_FROM: "no-reply@mygestia.immo", AUTH_URL: "https://app.test" },
}));
vi.mock("bcryptjs", () => ({ hash: vi.fn().mockResolvedValue("hashed-activation-code") }));

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
