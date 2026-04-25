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
