import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession } from "@/test/helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({ sendMail: vi.fn().mockResolvedValue({ success: true, emailId: "email-abc" }) }));

import { notifyTenantNewQuittance } from "./portal-notifications";
import { createAuditLog } from "@/lib/audit";
import { sendMail } from "@/lib/email";

const SOCIETY_ID = "soc-1";
const INVOICE_ID = "inv-1";

const baseInvoice = {
  id: INVOICE_ID,
  invoiceType: "QUITTANCE",
  fileUrl: "invoices/soc-1/2026/QUI-001.pdf",
  periodStart: new Date("2026-01-01"),
  periodEnd: new Date("2026-01-31"),
  issueDate: new Date("2026-02-01"),
  tenant: {
    firstName: "Marie",
    lastName: "Curie",
    email: "marie@example.com",
    entityType: "PERSONNE_PHYSIQUE",
    companyName: null,
  },
};

describe("notifyTenantNewQuittance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
  });

  it("envoie un email au locataire quand la quittance a un PDF disponible", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(baseInvoice as never);

    const result = await notifyTenantNewQuittance(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      "marie@example.com",
      expect.stringContaining("quittance"),
      expect.stringContaining("/portal")
    );
  });

  it("retourne une erreur si la facture est introuvable", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await notifyTenantNewQuittance(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("retourne une erreur si la facture n est pas une quittance", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      invoiceType: "APPEL_LOYER",
    } as never);

    const result = await notifyTenantNewQuittance(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("retourne une erreur si la quittance n a pas encore de PDF", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      fileUrl: null,
    } as never);

    const result = await notifyTenantNewQuittance(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("retourne une erreur si le locataire n a pas d email", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      tenant: { ...baseInvoice.tenant, email: null },
    } as never);

    const result = await notifyTenantNewQuittance(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("utilise le nom de societe pour une personne morale", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      tenant: {
        firstName: null,
        lastName: null,
        email: "contact@sarl.fr",
        entityType: "PERSONNE_MORALE",
        companyName: "SARL Dupont",
      },
    } as never);

    const result = await notifyTenantNewQuittance(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(true);
    const htmlArg = (sendMail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(htmlArg).toContain("SARL Dupont");
  });

  it("cree un audit log apres envoi reussi", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(baseInvoice as never);

    await notifyTenantNewQuittance(SOCIETY_ID, INVOICE_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Invoice",
        entityId: INVOICE_ID,
        details: expect.objectContaining({ event: "PORTAL_QUITTANCE_NOTIFICATION" }),
      })
    );
  });
});
