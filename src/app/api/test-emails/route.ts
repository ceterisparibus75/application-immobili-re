import { NextRequest, NextResponse } from "next/server";
import {
  sendReminderEmail,
  sendInvoiceEmail,
  sendReceiptEmail,
  sendSignupCodeEmail,
  sendNewUserEmail,
  sendWelcomeEmail,
  sendPortalActivationEmail,
  sendPortalLoginCodeEmail,
  sendInsuranceReminderEmail,
  sendDataroomDocumentAddedEmail,
  sendDataroomAccessEmail,
  sendInvoiceReminderEmail,
  sendPasswordResetEmail,
} from "@/lib/email";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const { secret } = await request.json();
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const TO = "maxime.langet@gmail.com";
  const baseUrl = process.env.AUTH_URL ?? "https://app.mygestia.immo";
  const results: Record<string, { success: boolean; error?: string }> = {};

  // 1. Relance niveau 1 (Rappel amiable)
  results["1_relance_amiable"] = await sendReminderEmail({
    to: TO,
    tenantName: "Jean Dupont",
    amount: 850,
    dueDate: "01/04/2026",
    invoiceRef: "FACT-2026-0042",
    reminderLevel: 1,
    societyName: "SCI AJ HOLD",
    contactEmail: "contact@ajhold.fr",
  });

  await delay(300);
  // 2. Relance niveau 2 (Relance formelle)
  results["2_relance_formelle"] = await sendReminderEmail({
    to: TO,
    tenantName: "Jean Dupont",
    amount: 850,
    dueDate: "01/04/2026",
    invoiceRef: "FACT-2026-0042",
    reminderLevel: 2,
    societyName: "SCI AJ HOLD",
    contactEmail: "contact@ajhold.fr",
  });

  await delay(300);
  // 3. Relance niveau 3 (Mise en demeure)
  results["3_mise_en_demeure"] = await sendReminderEmail({
    to: TO,
    tenantName: "Jean Dupont",
    amount: 850,
    dueDate: "01/04/2026",
    invoiceRef: "FACT-2026-0042",
    reminderLevel: 3,
    societyName: "SCI AJ HOLD",
    contactEmail: "contact@ajhold.fr",
  });

  await delay(300);
  // 4. Appel de loyer / Facture
  results["4_appel_loyer"] = await sendInvoiceEmail({
    to: TO,
    tenantName: "Jean Dupont",
    invoiceRef: "FACT-2026-0042",
    amount: 850,
    dueDate: "01/04/2026",
    period: "Avril 2026",
    societyName: "SCI AJ HOLD",
    typeLabel: "votre appel de loyer",
    items: [
      { label: "Loyer", amount: 750 },
      { label: "Charges", amount: 100 },
    ],
  });

  await delay(300);
  // 5. Quittance de loyer
  results["5_quittance"] = await sendReceiptEmail({
    to: TO,
    tenantName: "Jean Dupont",
    invoiceRef: "FACT-2026-0042",
    amount: 850,
    period: "Avril 2026",
    paidAt: "05/04/2026",
    societyName: "SCI AJ HOLD",
  });

  await delay(300);
  // 6. Code de confirmation inscription
  results["6_signup_code"] = await sendSignupCodeEmail({
    to: TO,
    name: "Maxime Langet",
    code: "847293",
  });

  await delay(300);
  // 7. Bienvenue nouvel utilisateur
  results["7_nouvel_utilisateur"] = await sendNewUserEmail({
    to: TO,
    name: "Maxime Langet",
    email: "maxime.langet@gmail.com",
    password: "Temp0r@ire2026!",
    appUrl: baseUrl,
    societyName: "SCI AJ HOLD",
  });

  await delay(300);
  // 8. Bienvenue nouveau locataire
  results["8_bienvenue_locataire"] = await sendWelcomeEmail({
    to: TO,
    tenantName: "Jean Dupont",
    propertyAddress: "12 rue de la Paix, 75002 Paris",
    leaseStart: "01/04/2026",
    monthlyRent: 850,
    societyName: "SCI AJ HOLD",
    contactEmail: "contact@ajhold.fr",
  });

  await delay(300);
  // 9. Activation portail locataire
  results["9_portail_activation"] = await sendPortalActivationEmail({
    to: TO,
    tenantName: "Jean Dupont",
    activationCode: "X7K9M2",
    portalUrl: baseUrl,
  });

  await delay(300);
  // 10. Code de connexion portail locataire
  results["10_portail_code_connexion"] = await sendPortalLoginCodeEmail({
    to: TO,
    tenantName: "Jean Dupont",
    code: "482916",
  });

  await delay(300);
  // 11. Relance attestation d'assurance
  results["11_relance_assurance"] = await sendInsuranceReminderEmail({
    to: TO,
    tenantName: "Jean Dupont",
    societyName: "SCI AJ HOLD",
    portalUrl: baseUrl,
  });

  await delay(300);
  // 12. Dataroom — document ajouté
  results["12_dataroom_document"] = await sendDataroomDocumentAddedEmail({
    to: TO,
    recipientName: "Maxime Langet",
    dataroomName: "Vente immeuble Rue de la Paix",
    documentName: "Diagnostic DPE 2026.pdf",
    documentCount: 8,
    dataroomUrl: `${baseUrl}/dataroom/example-token`,
    societyName: "SCI AJ HOLD",
  });

  await delay(300);
  // 13. Dataroom — notification d'accès
  results["13_dataroom_acces"] = await sendDataroomAccessEmail({
    to: TO,
    dataroomName: "Vente immeuble Rue de la Paix",
    viewerIp: "92.184.112.45",
    viewerEmail: "acheteur@example.com",
    accessedAt: "05/04/2026 à 23:15",
    dataroomUrl: `${baseUrl}/dataroom/example-token`,
  });

  await delay(300);
  // 14. Relance facture impayée (cron)
  results["14_relance_facture_cron"] = await sendInvoiceReminderEmail({
    to: TO,
    tenantName: "Jean Dupont",
    invoiceNumber: "FACT-2026-0042",
    amount: 850,
    dueDate: "01/04/2026",
    societyName: "SCI AJ HOLD",
  });

  await delay(300);
  // 15. Réinitialisation mot de passe
  results["15_reset_password"] = await sendPasswordResetEmail({
    to: TO,
    name: "Maxime Langet",
    resetUrl: `${baseUrl}/reset-password?token=example-token-abc123`,
  });

  const successCount = Object.values(results).filter((r) => r.success).length;
  const total = Object.keys(results).length;

  return NextResponse.json({
    message: `${successCount}/${total} emails envoyés à ${TO}`,
    results,
  });
}
