import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({ sendReminderEmail: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock("@/lib/email-copy", () => ({ getAllEmailCopyBcc: vi.fn().mockResolvedValue([]) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { sendManualReminder, sendBulkReminders } from "./reminder";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const INVOICE_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const LEASE_ID = "clh3x2z4k0002qh8g7z1y2v3v";
const TENANT_ID = "clh3x2z4k0003qh8g7z1y2v3w";
const REMINDER_ID = "clh3x2z4k0004qh8g7z1y2v3x";

function makeInvoice(overrides = {}) {
  return {
    id: INVOICE_ID,
    societyId: SOCIETY_ID,
    leaseId: LEASE_ID,
    invoiceNumber: "FAC-2025-0001",
    status: "EN_ATTENTE",
    totalHT: 1000,
    totalTTC: 1200,
    dueDate: new Date("2025-01-31"),
    lease: {
      tenant: {
        id: TENANT_ID,
        email: "locataire@example.com",
        entityType: "PERSONNE_PHYSIQUE",
        companyName: null,
        firstName: "Jean",
        lastName: "Dupont",
      },
      society: { id: SOCIETY_ID, name: "Ma SCI" },
    },
    payments: [],
    ...overrides,
  };
}

describe("sendManualReminder", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si facture non liée à un bail", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ leaseId: null }) as never);

    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bail/);
  });

  it("retourne une erreur si locataire non trouvé", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({ lease: { tenant: null, society: { id: SOCIETY_ID, name: "Ma SCI" } } }) as never
    );

    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Locataire/);
  });

  it("retourne une erreur si locataire sans email", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({
        lease: {
          tenant: { id: TENANT_ID, email: null, entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Dupont", companyName: null },
          society: { id: SOCIETY_ID, name: "Ma SCI" },
        },
      }) as never
    );

    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/);
  });

  it("envoie la relance avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.reminder.create.mockResolvedValue({ id: REMINDER_ID } as never);
    prismaMock.reminder.update.mockResolvedValue({} as never);

    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(result.success).toBe(true);
    expect(result.data?.reminderId).toBe(REMINDER_ID);
    expect(prismaMock.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ level: "RELANCE_1", invoiceIds: [INVOICE_ID] }),
      })
    );
  });

  it("met la facture en EN_RETARD si elle était EN_ATTENTE", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "EN_ATTENTE" }) as never);
    prismaMock.reminder.create.mockResolvedValue({ id: REMINDER_ID } as never);
    prismaMock.reminder.update.mockResolvedValue({} as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "EN_RETARD" } })
    );
  });

  it("retourne success avec avertissement si l'email échoue", async () => {
    const { sendReminderEmail } = await import("@/lib/email");
    vi.mocked(sendReminderEmail).mockResolvedValueOnce({ success: false });

    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.reminder.create.mockResolvedValue({ id: REMINDER_ID } as never);
    prismaMock.reminder.update.mockResolvedValue({} as never);

    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_2");
    expect(result.success).toBe(true);
    expect(result.data?.reminderId).toBe(REMINDER_ID);
    expect(result.error).toMatch(/email/);
  });

  it("calcule le montant restant en soustrayant les paiements", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({ totalTTC: 1200, payments: [{ amount: 200 }] }) as never
    );
    prismaMock.reminder.create.mockResolvedValue({ id: REMINDER_ID } as never);
    prismaMock.reminder.update.mockResolvedValue({} as never);

    await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(prismaMock.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 1000 }) })
    );
  });

  it("retourne une erreur générique si la BDD échoue dans sendManualReminder (lignes 150-152)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await sendManualReminder(SOCIETY_ID, INVOICE_ID, "RELANCE_1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("relance");
  });

  it("utilise le nom de société pour le sujet MISE_EN_DEMEURE", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.reminder.create.mockResolvedValue({ id: REMINDER_ID } as never);
    prismaMock.reminder.update.mockResolvedValue({} as never);

    await sendManualReminder(SOCIETY_ID, INVOICE_ID, "MISE_EN_DEMEURE");
    expect(prismaMock.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subject: "Mise en demeure de payer" }),
      })
    );
  });
});

describe("sendBulkReminders", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await sendBulkReminders(SOCIETY_ID, [INVOICE_ID], "RELANCE_1");
    expect(result.success).toBe(false);
  });

  it("retourne { sent: 0, failed: 0 } si liste vide", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);

    const result = await sendBulkReminders(SOCIETY_ID, [], "RELANCE_1");
    expect(result.success).toBe(true);
    expect(result.data?.sent).toBe(0);
    expect(result.data?.failed).toBe(0);
  });

  it("retourne une erreur générique si requireSocietyActionContext échoue (lignes 180-182)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.society.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await sendBulkReminders(SOCIETY_ID, [INVOICE_ID], "RELANCE_1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("relances");
  });

  it("compte les succès et les échecs", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);

    // 1er appel : facture trouvée → succès
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(makeInvoice() as never)
      // 2ème appel : facture introuvable → échec
      .mockResolvedValueOnce(null);
    prismaMock.reminder.create.mockResolvedValue({ id: REMINDER_ID } as never);
    prismaMock.reminder.update.mockResolvedValue({} as never);

    const ID2 = "clh3x2z4k0010qh8g7z1y2v3z";
    const result = await sendBulkReminders(SOCIETY_ID, [INVOICE_ID, ID2], "RELANCE_1");
    expect(result.success).toBe(true);
    expect(result.data?.sent).toBe(1);
    expect(result.data?.failed).toBe(1);
  });
});
