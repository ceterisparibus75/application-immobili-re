import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `"${process.env.NEXT_PUBLIC_APP_NAME ?? "Gestion Immobilière"}" <${process.env.EMAIL_FROM ?? "contact@mtggroupe.org"}>`;
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Gestion Immobilière";

// ============================================================
// TEMPLATE DE BASE
// ============================================================

function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .header { background: #18181b; padding: 24px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; color: #3f3f46; font-size: 15px; line-height: 1.6; }
    .body h2 { margin-top: 0; color: #18181b; font-size: 18px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
    .table th { text-align: left; padding: 8px 12px; background: #f4f4f5; color: #71717a; font-weight: 600; border-bottom: 1px solid #e4e4e7; }
    .table td { padding: 8px 12px; border-bottom: 1px solid #f4f4f5; }
    .badge-red { display: inline-block; padding: 2px 10px; background: #fee2e2; color: #dc2626; border-radius: 99px; font-size: 13px; font-weight: 600; }
    .badge-yellow { display: inline-block; padding: 2px 10px; background: #fef9c3; color: #ca8a04; border-radius: 99px; font-size: 13px; font-weight: 600; }
    .footer { padding: 20px 32px; background: #f4f4f5; color: #71717a; font-size: 13px; text-align: center; }
    hr { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>${APP_NAME}</h1></div>
    <div class="body">${content}</div>
    <div class="footer">Cet email a été envoyé automatiquement par ${APP_NAME}. Ne pas répondre à cet email.</div>
  </div>
</body>
</html>`;
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

interface EmailResult {
  success: boolean;
  error?: string;
}

async function sendMail(to: string, subject: string, html: string): Promise<EmailResult> {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return { success: true };
  } catch (error) {
    console.error("[sendMail]", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================
// RELANCE LOYER IMPAYÉ
// ============================================================

interface ReminderEmailParams {
  to: string;
  tenantName: string;
  amount: number;
  dueDate: string;
  invoiceRef: string;
  reminderLevel: 1 | 2 | 3;
  societyName: string;
  contactEmail?: string;
}

const REMINDER_LABELS = { 1: "Rappel amiable", 2: "Relance formelle", 3: "Mise en demeure" };

export async function sendReminderEmail(params: ReminderEmailParams): Promise<EmailResult> {
  const label = REMINDER_LABELS[params.reminderLevel];
  const urgencyClass = params.reminderLevel === 3 ? "badge-red" : params.reminderLevel === 2 ? "badge-yellow" : "";

  const content = `
    <h2>${label} — Loyer impayé</h2>
    ${urgencyClass ? `<p><span class="${urgencyClass}">${label}</span></p>` : ""}
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    ${params.reminderLevel === 1
      ? `<p>Nous vous informons que le règlement ci-dessous est en attente. Si vous avez déjà effectué ce paiement, veuillez ignorer ce message.</p>`
      : params.reminderLevel === 2
      ? `<p>Malgré notre précédent rappel, nous n'avons pas reçu le règlement. Nous vous demandons d'y remédier dans les plus brefs délais.</p>`
      : `<p>En l'absence de règlement suite à nos précédentes relances, nous vous adressons la présente <strong>mise en demeure</strong> de régler immédiatement la somme due, faute de quoi nous serons contraints d'engager une procédure judiciaire.</p>`
    }
    <table class="table">
      <tr><th>Référence</th><td>${params.invoiceRef}</td></tr>
      <tr><th>Échéance</th><td>${params.dueDate}</td></tr>
      <tr><th>Montant dû</th><td><strong>${fmt(params.amount)}</strong></td></tr>
    </table>
    ${params.contactEmail ? `<p>Pour toute question : <a href="mailto:${params.contactEmail}">${params.contactEmail}</a></p>` : ""}
    <hr/><p style="color:#71717a;font-size:13px;">${params.societyName}</p>
  `;

  return sendMail(params.to, `[${label}] Loyer impayé — ${params.invoiceRef} — ${fmt(params.amount)}`, baseTemplate(`${label} — Loyer impayé`, content));
}

// ============================================================
// APPEL DE LOYER
// ============================================================

interface InvoiceEmailParams {
  to: string;
  tenantName: string;
  invoiceRef: string;
  amount: number;
  dueDate: string;
  period: string;
  societyName: string;
  items?: Array<{ label: string; amount: number }>;
}

export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<EmailResult> {
  const itemsHtml = params.items?.length
    ? `<table class="table"><thead><tr><th>Désignation</th><th style="text-align:right">Montant</th></tr></thead><tbody>
        ${params.items.map((i) => `<tr><td>${i.label}</td><td style="text-align:right">${fmt(i.amount)}</td></tr>`).join("")}
      </tbody></table>`
    : "";

  const content = `
    <h2>Appel de loyer — ${params.period}</h2>
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    <p>Votre appel de loyer pour la période <strong>${params.period}</strong> :</p>
    ${itemsHtml}
    <table class="table">
      <tr><th>Référence</th><td>${params.invoiceRef}</td></tr>
      <tr><th>Échéance</th><td>${params.dueDate}</td></tr>
      <tr><th>Montant total</th><td><strong style="font-size:18px">${fmt(params.amount)}</strong></td></tr>
    </table>
    <hr/><p style="color:#71717a;font-size:13px;">${params.societyName}</p>
  `;

  return sendMail(params.to, `Appel de loyer ${params.period} — ${params.invoiceRef}`, baseTemplate(`Appel de loyer ${params.period}`, content));
}

// ============================================================
// QUITTANCE DE LOYER
// ============================================================

interface ReceiptEmailParams {
  to: string;
  tenantName: string;
  invoiceRef: string;
  amount: number;
  period: string;
  paidAt: string;
  societyName: string;
}

export async function sendReceiptEmail(params: ReceiptEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Quittance de loyer — ${params.period}</h2>
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    <p>Nous accusons réception de votre paiement et vous adressons votre quittance.</p>
    <table class="table">
      <tr><th>Référence</th><td>${params.invoiceRef}</td></tr>
      <tr><th>Période</th><td>${params.period}</td></tr>
      <tr><th>Montant réglé</th><td><strong>${fmt(params.amount)}</strong></td></tr>
      <tr><th>Date de paiement</th><td>${params.paidAt}</td></tr>
    </table>
    <p>Nous vous remercions de votre règlement.</p>
    <hr/><p style="color:#71717a;font-size:13px;">${params.societyName}</p>
  `;

  return sendMail(params.to, `Quittance de loyer ${params.period} — ${params.invoiceRef}`, baseTemplate(`Quittance de loyer ${params.period}`, content));
}

// ============================================================
// BIENVENUE NOUVEL UTILISATEUR
// ============================================================

interface NewUserEmailParams {
  to: string;
  name: string;
  email: string;
  password: string;
  appUrl: string;
  societyName?: string;
}

export async function sendNewUserEmail(params: NewUserEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Votre accès à ${APP_NAME}</h2>
    <p>Bonjour <strong>${params.name}</strong>,</p>
    <p>Un compte a été créé pour vous sur <strong>${APP_NAME}</strong>${params.societyName ? ` pour la société <strong>${params.societyName}</strong>` : ""}.</p>
    <p>Voici vos identifiants de connexion :</p>
    <table class="table">
      <tr><th>Adresse email</th><td>${params.email}</td></tr>
      <tr><th>Mot de passe</th><td><strong style="font-family:monospace;font-size:16px">${params.password}</strong></td></tr>
    </table>
    <p style="margin-top:24px">
      <a href="${params.appUrl}" style="display:inline-block;padding:10px 24px;background:#18181b;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
        Se connecter
      </a>
    </p>
    <p style="color:#dc2626;font-size:13px;margin-top:16px">⚠️ Pour des raisons de sécurité, nous vous recommandons de modifier votre mot de passe dès votre première connexion.</p>
    <hr/><p style="color:#71717a;font-size:13px;">${APP_NAME}</p>
  `;

  return sendMail(params.to, `Votre accès à ${APP_NAME}`, baseTemplate(`Votre accès à ${APP_NAME}`, content));
}

// ============================================================
// BIENVENUE NOUVEAU LOCATAIRE
// ============================================================

interface WelcomeEmailParams {
  to: string;
  tenantName: string;
  propertyAddress: string;
  leaseStart: string;
  monthlyRent: number;
  societyName: string;
  contactEmail?: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Bienvenue dans votre nouveau logement</h2>
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    <p>Bienvenue à <strong>${params.propertyAddress}</strong>. Voici votre récapitulatif de bail :</p>
    <table class="table">
      <tr><th>Adresse</th><td>${params.propertyAddress}</td></tr>
      <tr><th>Entrée dans les lieux</th><td>${params.leaseStart}</td></tr>
      <tr><th>Loyer mensuel</th><td><strong>${fmt(params.monthlyRent)}</strong></td></tr>
    </table>
    ${params.contactEmail ? `<p>Contact : <a href="mailto:${params.contactEmail}">${params.contactEmail}</a></p>` : ""}
    <p>Nous vous souhaitons un agréable séjour.</p>
    <hr/><p style="color:#71717a;font-size:13px;">${params.societyName}</p>
  `;

  return sendMail(params.to, `Bienvenue — Votre bail au ${params.propertyAddress}`, baseTemplate("Bienvenue dans votre nouveau logement", content));
}
