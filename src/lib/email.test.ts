import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmailsSend = vi.hoisted(() => vi.fn());

vi.mock("resend", () => {
  const send = mockEmailsSend;
  return {
    Resend: class {
      emails = { send };
    },
  };
});

import {
  sendMail,
  sendReminderEmail,
  sendInvoiceEmail,
  sendReceiptEmail,
  sendSignupCodeEmail,
  sendPasswordResetEmail,
  sendNewUserEmail,
  sendNewUserInviteEmail,
  sendWelcomeEmail,
  sendPortalActivationEmail,
  sendPortalLoginCodeEmail,
  sendInsuranceReminderEmail,
  sendDataroomDocumentAddedEmail,
  sendDataroomAccessEmail,
  sendInvoiceReminderEmail,
  sendConsolidatedReportEmail,
  sendLetterEmail,
  sendWelcomeTrialEmail,
} from "./email";

beforeEach(() => {
  mockEmailsSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
});

// ── sendMail ───────────────────────────────────────────────────

describe("sendMail", () => {
  it("retourne success:true avec l'emailId en cas de succès", async () => {
    const result = await sendMail("to@example.com", "Sujet test", "<p>Contenu</p>");
    expect(result.success).toBe(true);
    expect(result.emailId).toBe("email-123");
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "to@example.com",
        subject: "Sujet test",
        html: "<p>Contenu</p>",
      })
    );
  });

  it("retourne success:false si Resend retourne une erreur", async () => {
    mockEmailsSend.mockResolvedValue({ data: null, error: { message: "Invalid API key" } });

    const result = await sendMail("to@example.com", "Sujet", "<p>Test</p>");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid API key");
  });

  it("retourne success:false si une exception est levée", async () => {
    mockEmailsSend.mockRejectedValue(new Error("Network error"));

    const result = await sendMail("to@example.com", "Sujet", "<p>Test</p>");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });

  it("inclut les pièces jointes si fournies", async () => {
    const attachment = { filename: "test.pdf", content: Buffer.from("pdf content") };

    await sendMail("to@example.com", "Sujet", "<p>Test</p>", [attachment]);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [expect.objectContaining({ filename: "test.pdf" })],
      })
    );
  });

  it("inclut les BCC si fournis", async () => {
    await sendMail("to@example.com", "Sujet", "<p>Test</p>", undefined, undefined, ["bcc@example.com"]);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ bcc: ["bcc@example.com"] })
    );
  });
});

// ── sendReminderEmail ──────────────────────────────────────────

describe("sendReminderEmail", () => {
  const baseParams = {
    to: "locataire@example.com",
    tenantName: "Jean Dupont",
    amount: 850,
    dueDate: "05/01/2025",
    invoiceRef: "FAC-2025-001",
    societyName: "SCI Test",
    reminderLevel: 1 as const,
  };

  it("envoie un rappel amiable (niveau 1)", async () => {
    const result = await sendReminderEmail(baseParams);
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "locataire@example.com",
        subject: expect.stringContaining("FAC-2025-001"),
      })
    );
  });

  it("envoie une mise en demeure (niveau 3)", async () => {
    const result = await sendReminderEmail({ ...baseParams, reminderLevel: 3 });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Mise en demeure") })
    );
  });

  it("retourne success:false si Resend échoue", async () => {
    mockEmailsSend.mockResolvedValue({ data: null, error: { message: "Rate limit" } });

    const result = await sendReminderEmail(baseParams);
    expect(result.success).toBe(false);
  });
});

// ── sendInvoiceEmail ───────────────────────────────────────────

describe("sendInvoiceEmail", () => {
  it("envoie la facture avec succès", async () => {
    const result = await sendInvoiceEmail({
      to: "locataire@example.com",
      tenantName: "Jean Dupont",
      invoiceRef: "FAC-2025-001",
      amount: 850,
      dueDate: "05/01/2025",
      period: "janvier 2025",
      societyName: "SCI Test",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "locataire@example.com",
        subject: expect.stringContaining("FAC-2025-001"),
      })
    );
  });
});

// ── sendReceiptEmail ───────────────────────────────────────────

describe("sendReceiptEmail", () => {
  it("envoie la quittance avec succès", async () => {
    const result = await sendReceiptEmail({
      to: "locataire@example.com",
      tenantName: "Jean Dupont",
      invoiceRef: "QUI-2025-001",
      amount: 850,
      period: "janvier 2025",
      paidAt: "10/01/2025",
      societyName: "SCI Test",
    });
    expect(result.success).toBe(true);
  });
});

// ── sendSignupCodeEmail ────────────────────────────────────────

describe("sendSignupCodeEmail", () => {
  it("envoie le code d'inscription avec succès", async () => {
    const result = await sendSignupCodeEmail({
      to: "nouveau@example.com",
      name: "Jean Dupont",
      code: "123456",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "nouveau@example.com" })
    );
  });
});

// ── sendPasswordResetEmail ─────────────────────────────────────

describe("sendPasswordResetEmail", () => {
  it("envoie l'email de réinitialisation avec succès", async () => {
    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      name: "Dupont",
      resetUrl: "https://app.example.com/reset-password?token=reset-token-abc",
    });
    expect(result.success).toBe(true);
  });
});

// ── sendNewUserEmail ───────────────────────────────────────────

describe("sendNewUserEmail", () => {
  it("envoie les identifiants au nouvel utilisateur avec succès", async () => {
    const result = await sendNewUserEmail({
      to: "user@example.com",
      name: "Alice Martin",
      email: "user@example.com",
      password: "Passw0rd!",
      appUrl: "https://app.example.com",
      societyName: "SCI Test",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });
});

// ── sendNewUserInviteEmail ─────────────────────────────────────

describe("sendNewUserInviteEmail", () => {
  it("envoie l'invitation avec lien de création de mot de passe", async () => {
    const result = await sendNewUserInviteEmail({
      to: "invite@example.com",
      name: "Bob Dupont",
      email: "invite@example.com",
      resetUrl: "https://app.example.com/set-password?token=abc",
      appUrl: "https://app.example.com",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "invite@example.com",
        subject: expect.stringContaining("Activez votre compte"),
      })
    );
  });
});

// ── sendWelcomeEmail ───────────────────────────────────────────

describe("sendWelcomeEmail", () => {
  it("envoie l'email de bienvenue locataire avec succès", async () => {
    const result = await sendWelcomeEmail({
      to: "locataire@example.com",
      tenantName: "Marie Curie",
      propertyAddress: "12 rue de la Paix, Paris",
      leaseStart: "01/02/2026",
      monthlyRent: 900,
      societyName: "SCI Patrimoine",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "locataire@example.com" })
    );
  });
});

// ── sendPortalActivationEmail ──────────────────────────────────

describe("sendPortalActivationEmail", () => {
  it("envoie le code d'activation du portail locataire", async () => {
    const result = await sendPortalActivationEmail({
      to: "tenant@example.com",
      tenantName: "Jean Valjean",
      activationCode: "A1B2C3",
      portalUrl: "https://portal.example.com",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("espace locataire"),
      })
    );
  });
});

// ── sendPortalLoginCodeEmail ───────────────────────────────────

describe("sendPortalLoginCodeEmail", () => {
  it("envoie le code de connexion OTP au portail", async () => {
    const result = await sendPortalLoginCodeEmail({
      to: "tenant@example.com",
      tenantName: "Jean Valjean",
      code: "748291",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Code de connexion"),
      })
    );
  });
});

// ── sendInsuranceReminderEmail ─────────────────────────────────

describe("sendInsuranceReminderEmail", () => {
  it("envoie le rappel d'attestation d'assurance", async () => {
    const result = await sendInsuranceReminderEmail({
      to: "tenant@example.com",
      tenantName: "Sophie Martin",
      societyName: "SCI Test",
      portalUrl: "https://portal.example.com",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("assurance"),
      })
    );
  });
});

// ── sendDataroomDocumentAddedEmail ─────────────────────────────

describe("sendDataroomDocumentAddedEmail", () => {
  it("notifie l'ajout d'un document dans une dataroom", async () => {
    const result = await sendDataroomDocumentAddedEmail({
      to: "investor@example.com",
      recipientName: "Paul Investor",
      dataroomName: "SCI Patrimoine — Due Diligence",
      documentName: "Bilan 2025.pdf",
      documentCount: 5,
      dataroomUrl: "https://app.example.com/dataroom/dr-1",
      societyName: "SCI Patrimoine",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Nouveau document"),
      })
    );
  });

  it("fonctionne sans recipientName (null)", async () => {
    const result = await sendDataroomDocumentAddedEmail({
      to: "anon@example.com",
      recipientName: null,
      dataroomName: "Dataroom",
      documentName: "doc.pdf",
      documentCount: 1,
      dataroomUrl: "https://app.example.com/dataroom/dr-2",
      societyName: "SCI Test",
    });
    expect(result.success).toBe(true);
  });
});

// ── sendDataroomAccessEmail ────────────────────────────────────

describe("sendDataroomAccessEmail", () => {
  it("notifie l'accès à une dataroom avec email et IP", async () => {
    const result = await sendDataroomAccessEmail({
      to: "owner@example.com",
      dataroomName: "Due Diligence 2026",
      viewerIp: "192.168.1.1",
      viewerEmail: "viewer@example.com",
      accessedAt: "25/04/2026 à 10h30",
      dataroomUrl: "https://app.example.com/dataroom/dr-1",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Dataroom"),
      })
    );
  });
});

// ── sendInvoiceReminderEmail ───────────────────────────────────

describe("sendInvoiceReminderEmail", () => {
  it("envoie le rappel de facture impayée", async () => {
    const result = await sendInvoiceReminderEmail({
      to: "client@example.com",
      tenantName: "Entreprise Dupont",
      invoiceNumber: "F-2026-042",
      amount: 1200,
      dueDate: "30/04/2026",
      societyName: "SCI Test",
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("F-2026-042"),
      })
    );
  });
});

// ── sendConsolidatedReportEmail ────────────────────────────────

describe("sendConsolidatedReportEmail", () => {
  it("envoie le rapport consolidé avec pièce jointe", async () => {
    const result = await sendConsolidatedReportEmail({
      to: "manager@example.com",
      scheduleName: "Rapport mensuel avril",
      frequencyLabel: "Mensuel",
      reportLabels: ["Situation locative", "Impayés"],
      societyName: "SCI Test",
      attachment: { filename: "rapport-avril.pdf", content: Buffer.from("pdf") },
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: "rapport-avril.pdf" }),
        ]),
      })
    );
  });
});

// ── sendLetterEmail ────────────────────────────────────────────

describe("sendLetterEmail", () => {
  it("envoie un courrier type avec pièce jointe PDF", async () => {
    const result = await sendLetterEmail({
      to: "tenant@example.com",
      tenantName: "Jean Dupont",
      subject: "Mise en demeure",
      societyName: "SCI Test",
      attachment: { filename: "mise-en-demeure.pdf", content: Buffer.from("pdf") },
    });
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: "mise-en-demeure.pdf" }),
        ]),
      })
    );
  });
});

// ── sendWelcomeTrialEmail ──────────────────────────────────────

describe("sendWelcomeTrialEmail", () => {
  it("envoie l'email de bienvenue à l'inscription avec les étapes de démarrage", async () => {
    const result = await sendWelcomeTrialEmail("new@example.com", "Alice", "Starter");
    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        subject: expect.stringContaining("essai"),
      })
    );
  });
});
