import { Resend } from "resend";

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? ""); }
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
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #f2f2f2; font-family: Arial, Helvetica, sans-serif; }
    .outer { background: #f2f2f2; padding: 40px 16px; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e0e0e0; }
    .header { padding: 24px 40px; border-bottom: 1px solid #e8e8e8; }
    .header h1 { margin: 0; color: #444444; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .body { padding: 40px; color: #222222; font-size: 14.5px; line-height: 1.75; }
    .body h2 { margin: 0 0 20px; color: #111111; font-size: 15px; font-weight: 700; }
    .body p { margin: 0 0 16px; }
    .body strong { color: #111111; }
    .table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13.5px; border: 1px solid #e0e0e0; }
    .table th { text-align: left; padding: 10px 16px; background: #f7f7f7; color: #666666; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #e0e0e0; }
    .table td { padding: 12px 16px; border-bottom: 1px solid #e8e8e8; color: #222222; }
    .table tr:last-child td { border-bottom: none; }
    .amount { font-size: 18px !important; font-weight: 700; color: #111111 !important; }
    .badge-red { display: inline-block; padding: 3px 10px; background: #fff0f0; color: #cc0000; border-radius: 4px; font-size: 12px; font-weight: 700; border: 1px solid #ffcccc; }
    .badge-yellow { display: inline-block; padding: 3px 10px; background: #fffbeb; color: #b45309; border-radius: 4px; font-size: 12px; font-weight: 700; border: 1px solid #fde68a; }
    .footer { padding: 16px 40px; background: #f7f7f7; color: #aaaaaa; font-size: 11px; border-top: 1px solid #e8e8e8; line-height: 1.5; }
    hr { border: none; border-top: 1px solid #e8e8e8; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="outer">
    <div class="wrapper">
      <div class="header"><h1>${APP_NAME}</h1></div>
      <div class="body">${content}</div>
      <div class="footer">Cet email a été envoyé automatiquement par ${APP_NAME}. Ne pas répondre à cet email.</div>
    </div>
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

async function sendMail(to: string, subject: string, html: string, attachments?: Array<{ filename: string; content: Buffer }>): Promise<EmailResult> {
  try {
    const { data, error } = await getResend().emails.send({ from: FROM, to, subject, html, ...(attachments?.length ? { attachments: attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') })) } : {}) });
    if (error) {
      console.error("[sendMail] Resend error:", error);
      return { success: false, error: (error as { message?: string }).message ?? String(error) };
    }
    console.log("[sendMail] Envoye OK, id:", data?.id, "| a:", to, "| sujet:", subject);
    return { success: true };
  } catch (error) {
    console.error("[sendMail] exception:", error);
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
    <hr/><p style="color:#888888;font-size:12px;">${params.societyName}</p>
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
  typeLabel?: string;
  items?: Array<{ label: string; amount: number }>;
  pdfAttachment?: { filename: string; content: Buffer };
}

export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<EmailResult> {
  const typeLabel = params.typeLabel ?? "votre facture";
  const typeLabelCapitalized = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

  const content = `
    <p>Madame, Monsieur,</p>
    <p>Nous vous prions de bien vouloir trouver ci-joint ${typeLabel} n°&nbsp;<strong>${params.invoiceRef}</strong> concernant vos locaux pour la période de <strong>${params.period}</strong>.</p>
    <p>Nous vous remercions de bien vouloir régler cette somme à la date d'échéance indiquée.</p>
    <p>Pour toute question relative à ce document, n'hésitez pas à nous contacter.</p>
    <p style="margin-bottom:32px;">Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
    <p>Le gérant<br/>${params.societyName}</p>
  `;

  return sendMail(
    params.to,
    `${typeLabelCapitalized} ${params.period} — ${params.invoiceRef}`,
    baseTemplate(`${typeLabelCapitalized} ${params.period}`, content),
    params.pdfAttachment ? [params.pdfAttachment] : undefined
  );
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
    <hr/><p style="color:#888888;font-size:12px;">${params.societyName}</p>
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
      <a href="${params.appUrl}" style="display:inline-block;padding:10px 24px;background:#333333;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">
        Se connecter
      </a>
    </p>
    <p style="color:#cc0000;font-size:13px;margin-top:16px">⚠️ Pour des raisons de sécurité, nous vous recommandons de modifier votre mot de passe dès votre première connexion.</p>
    <hr/><p style="color:#888888;font-size:12px;">${APP_NAME}</p>
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
    <hr/><p style="color:#888888;font-size:12px;">${params.societyName}</p>
  `;

  return sendMail(params.to, `Bienvenue — Votre bail au ${params.propertyAddress}`, baseTemplate("Bienvenue dans votre nouveau logement", content));
}

// ============================================================
// PORTAIL LOCATAIRE — ACTIVATION
// ============================================================

interface PortalActivationEmailParams {
  to: string;
  tenantName: string;
  activationCode: string;
  portalUrl: string;
}

export async function sendPortalActivationEmail(params: PortalActivationEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Activez votre espace locataire</h2>
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    <p>Votre espace locataire a été créé. Utilisez le code ci-dessous pour l'activer :</p>
    <p style="text-align:center;margin:32px 0">
      <span style="display:inline-block;padding:16px 32px;background:#333333;color:#ffffff;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:8px;font-family:monospace">${params.activationCode}</span>
    </p>
    <p style="text-align:center">
      <a href="${params.portalUrl}/portal/activate" style="display:inline-block;padding:10px 24px;background:#333333;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">
        Activer mon espace
      </a>
    </p>
    <p style="color:#888888;font-size:13px">Ce code expire dans 48 heures.</p>
    <hr/><p style="color:#888888;font-size:12px;">${APP_NAME}</p>
  `;

  return sendMail(params.to, `Activez votre espace locataire — ${APP_NAME}`, baseTemplate("Activez votre espace locataire", content));
}

// ============================================================
// PORTAIL LOCATAIRE — CODE DE CONNEXION
// ============================================================

interface PortalLoginCodeEmailParams {
  to: string;
  tenantName: string;
  code: string;
}

export async function sendPortalLoginCodeEmail(params: PortalLoginCodeEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Votre code de connexion</h2>
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    <p>Voici votre code de connexion à votre espace locataire :</p>
    <p style="text-align:center;margin:32px 0">
      <span style="display:inline-block;padding:16px 32px;background:#333333;color:#ffffff;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:8px;font-family:monospace">${params.code}</span>
    </p>
    <p style="color:#888888;font-size:13px">Ce code expire dans 15 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.</p>
    <hr/><p style="color:#888888;font-size:12px;">${APP_NAME}</p>
  `;

  return sendMail(params.to, `Code de connexion — ${APP_NAME}`, baseTemplate("Code de connexion", content));
}

// ============================================================
// RELANCE ATTESTATION D'ASSURANCE
// ============================================================

interface InsuranceReminderEmailParams {
  to: string;
  tenantName: string;
  societyName: string;
  portalUrl: string;
}

export async function sendInsuranceReminderEmail(params: InsuranceReminderEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Attestation d'assurance requise</h2>
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    <p>Conformément à votre bail, vous devez nous fournir une <strong>attestation d'assurance</strong> en cours de validité.</p>
    <p>À ce jour, nous n'avons pas reçu ce document. Nous vous invitons à le déposer dans votre espace locataire dans les meilleurs délais.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${params.portalUrl}/portal/assurance" style="display:inline-block;padding:10px 24px;background:#333333;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">
        Déposer mon attestation
      </a>
    </p>
    <hr/><p style="color:#888888;font-size:12px;">${params.societyName}</p>
  `;

  return sendMail(params.to, `Rappel — Attestation d'assurance requise`, baseTemplate("Attestation d'assurance requise", content));
}

// ============================================================
// RELANCE FACTURE IMPAYÉE (CRON)
// ============================================================

interface InvoiceReminderEmailParams {
  to: string;
  tenantName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  societyName: string;
}

export async function sendInvoiceReminderEmail(params: InvoiceReminderEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Rappel — Facture en attente de règlement</h2>
    <p>Bonjour <strong>${params.tenantName}</strong>,</p>
    <p>Nous vous informons que la facture ci-dessous est en attente de règlement :</p>
    <table class="table">
      <tr><th>N° Facture</th><td>${params.invoiceNumber}</td></tr>
      <tr><th>Échéance</th><td>${params.dueDate}</td></tr>
      <tr><th>Montant dû</th><td><strong>${fmt(params.amount)}</strong></td></tr>
    </table>
    <p>Si vous avez déjà effectué ce paiement, merci de ne pas tenir compte de ce message.</p>
    <hr/><p style="color:#888888;font-size:12px;">${params.societyName}</p>
  `;

  return sendMail(params.to, `Rappel — Facture ${params.invoiceNumber} — ${fmt(params.amount)}`, baseTemplate("Rappel — Facture impayée", content));
}
