import { Resend } from "resend";

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? ""); }
const FROM = `"${process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia"}" <${process.env.EMAIL_FROM ?? "contact@mygestia.immo"}>`;
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";
const SITE_URL = process.env.AUTH_URL ?? "https://app.mygestia.immo";

// ============================================================
// DESIGN SYSTEM — LOGO 2.4
// ============================================================

const BRAND = {
  deep: "#0C2340",
  blue: "#1B4F8A",
  cyan: "#22B8CF",
  light: "#E0F7FA",
  text: "#334155",
  muted: "#94A3B8",
  bg: "#F9FAFB",
  white: "#FFFFFF",
  border: "#F1F5F9",
  gradient: "linear-gradient(135deg, #1B4F8A 0%, #22B8CF 100%)",
};

// ============================================================
// BASE TEMPLATE — Table-based, inline CSS, responsive
// ============================================================

function baseTemplate(title: string, content: string, options?: { societyName?: string; borderLeftColor?: string }): string {
  const footerName = options?.societyName ?? APP_NAME;
  const borderLeft = options?.borderLeftColor ? `border-left:4px solid ${options.borderLeftColor};` : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .outer-table { width: 100% !important; }
      .inner-pad { padding: 28px 20px !important; }
      .header-pad { padding: 24px 20px !important; }
      .footer-pad { padding: 16px 20px !important; }
      .info-table { width: 100% !important; }
      .code-text { font-size: 28px !important; letter-spacing: 6px !important; }
      .cta-btn { padding: 14px 28px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${BRAND.bg};padding:40px 16px;">
    <tr><td align="center">
      <table class="outer-table" width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${BRAND.white};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(12,35,64,0.04),0 8px 24px rgba(12,35,64,0.06);${borderLeft}">

        <!-- HEADER : Logo texte stylisé (fiable dans tous les clients email) -->
        <tr>
          <td class="header-pad" align="center" style="padding:32px 40px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
                  <span style="color:${BRAND.blue};">My</span><span style="color:${BRAND.cyan};">Gestia</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td class="inner-pad" style="padding:0 40px 40px;">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="footer-pad" style="padding:20px 40px;background-color:${BRAND.bg};border-top:1px solid ${BRAND.border};">
            <p style="margin:0 0 4px;color:${BRAND.muted};font-size:11px;text-align:center;line-height:1.6;">
              ${footerName} — Gestion locative intelligente
            </p>
            <p style="margin:0;color:${BRAND.muted};font-size:11px;text-align:center;line-height:1.6;">
              <a href="${SITE_URL}" style="color:${BRAND.blue};text-decoration:none;">mygestia.immo</a>
            </p>
          </td>
        </tr>

      </table>

      <!-- UNSUBSCRIBE / LEGAL -->
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
        <tr>
          <td style="padding:16px 0;text-align:center;">
            <p style="margin:0;color:#CBD5E1;font-size:10px;line-height:1.5;">
              Cet email a été envoyé automatiquement par ${APP_NAME}. Pour toute question, répondez à cet email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================================
// COMPOSANTS RÉUTILISABLES
// ============================================================

/** Bouton CTA principal — dégradé bleu du logo */
function ctaButton(label: string, href: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:24px 0 8px;">
        <a href="${href}" class="cta-btn" style="display:inline-block;padding:14px 36px;background-color:${BRAND.blue};color:${BRAND.white};text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:-0.2px;" target="_blank">
          ${label}
        </a>
      </td></tr>
    </table>`;
}

/** Tableau d'informations (clé-valeur) */
function infoTable(rows: Array<{ label: string; value: string; bold?: boolean }>): string {
  const rowsHtml = rows.map((r) => `
    <tr>
      <td style="padding:10px 16px;color:${BRAND.muted};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid ${BRAND.border};white-space:nowrap;vertical-align:top;">${r.label}</td>
      <td style="padding:10px 16px;color:${r.bold ? BRAND.deep : BRAND.text};font-size:14px;font-weight:${r.bold ? "700" : "400"};border-bottom:1px solid ${BRAND.border};text-align:right;">${r.value}</td>
    </tr>`).join("");

  return `
    <table class="info-table" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:8px;overflow:hidden;background:${BRAND.bg};margin:20px 0;">
      ${rowsHtml}
    </table>`;
}

/** Encadré de code (OTP, mot de passe...) */
function codeBlock(code: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:28px 0;">
        <div style="display:inline-block;padding:20px 40px;background:${BRAND.bg};border:2px solid ${BRAND.border};border-radius:12px;">
          <span class="code-text" style="font-size:36px;font-weight:800;letter-spacing:10px;color:${BRAND.deep};font-family:'JetBrains Mono','Courier New',monospace;">${code}</span>
        </div>
      </td></tr>
    </table>`;
}

/** Encadré d'information */
function infoBox(text: string, variant: "info" | "warning" | "success" = "info"): string {
  const colors = {
    info: { bg: BRAND.light, border: "#B2EBF2", text: BRAND.deep },
    warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
    success: { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" },
  };
  const c = colors[variant];
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${c.bg};border:1px solid ${c.border};border-radius:8px;margin:16px 0;">
      <tr><td style="padding:12px 16px;">
        <p style="margin:0;color:${c.text};font-size:13px;line-height:1.5;">${text}</p>
      </td></tr>
    </table>`;
}

/** Titre h2 */
function heading(text: string): string {
  return `<h2 style="margin:0 0 8px;color:${BRAND.deep};font-size:20px;font-weight:700;line-height:1.3;">${text}</h2>`;
}

/** Paragraphe */
function para(text: string, opts?: { muted?: boolean; small?: boolean }): string {
  const color = opts?.muted ? BRAND.muted : BRAND.text;
  const size = opts?.small ? "12px" : "14.5px";
  return `<p style="margin:0 0 16px;color:${color};font-size:${size};line-height:1.7;">${text}</p>`;
}

/** Badge de statut discret */
function badge(text: string, variant: "default" | "amber" | "red" = "default"): string {
  const colors = {
    default: { bg: BRAND.bg, text: BRAND.deep },
    amber: { bg: "#FFFBEB", text: "#D97706" },
    red: { bg: "#FEF2F2", text: "#DC2626" },
  };
  const c = colors[variant];
  return `<span style="display:inline-block;padding:3px 10px;background:${c.bg};color:${c.text};border-radius:4px;font-size:12px;font-weight:600;">${text}</span>`;
}

/** Signature société */
function signature(name: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;border-top:1px solid ${BRAND.border};padding-top:16px;">
      <tr><td>
        <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.5;">${name}</p>
      </td></tr>
    </table>`;
}

// ============================================================
// HELPERS
// ============================================================

function fmt(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

interface EmailResult {
  success: boolean;
  error?: string;
  emailId?: string;
}

async function sendMail(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: Buffer }>,
  replyTo?: string,
  bcc?: string | string[]
): Promise<EmailResult> {
  try {
    const fromAddress = process.env.EMAIL_FROM ?? "contact@mygestia.immo";
    const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]).filter(Boolean) : [];
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to,
      subject,
      html,
      replyTo: replyTo ?? fromAddress,
      ...(bccList.length > 0 ? { bcc: bccList } : {}),
      ...(attachments?.length
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }
        : {}),
    });
    if (error) {
      console.error("[sendMail] Resend error:", error);
      return { success: false, error: (error as { message?: string }).message ?? String(error) };
    }
    // eslint-disable-next-line no-console
    console.log("[sendMail] Envoye OK, id:", data?.id, "| a:", to, "| sujet:", subject);
    return { success: true, emailId: data?.id };
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
  bcc?: string | string[];
}

const REMINDER_LABELS = { 1: "Rappel amiable", 2: "Relance formelle", 3: "Mise en demeure" };

export async function sendReminderEmail(params: ReminderEmailParams): Promise<EmailResult> {
  const label = REMINDER_LABELS[params.reminderLevel];
  const badgeVariant = params.reminderLevel === 3 ? "red" : params.reminderLevel === 2 ? "amber" : "default";

  const content = `
    ${heading(`${label} — Loyer impayé`)}
    ${params.reminderLevel >= 2 ? `<p style="margin:0 0 16px;">${badge(label, badgeVariant)}</p>` : ""}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${params.reminderLevel === 1
      ? para("Nous vous informons que le règlement ci-dessous est en attente. Si vous avez déjà effectué ce paiement, veuillez ignorer ce message.")
      : params.reminderLevel === 2
      ? para("Malgré notre précédent rappel, nous n'avons pas reçu le règlement. Nous vous demandons d'y remédier dans les plus brefs délais.")
      : para("En l'absence de règlement suite à nos précédentes relances, nous vous adressons la présente <strong>mise en demeure</strong> de régler immédiatement la somme due, faute de quoi nous serons contraints d'engager une procédure judiciaire.")
    }
    ${infoTable([
      { label: "Référence", value: params.invoiceRef },
      { label: "Échéance", value: params.dueDate },
      { label: "Montant dû", value: fmt(params.amount), bold: true },
    ])}
    ${params.contactEmail ? para(`Pour toute question : <a href="mailto:${params.contactEmail}" style="color:${BRAND.blue};text-decoration:none;">${params.contactEmail}</a>`) : ""}
    ${signature(params.societyName)}
  `;

  // Relances : bordure latérale bleu marine pour ton formel
  return sendMail(
    params.to,
    `[${label}] Loyer impayé — ${params.invoiceRef} — ${fmt(params.amount)}`,
    baseTemplate(`${label} — Loyer impayé`, content, { societyName: params.societyName, borderLeftColor: BRAND.deep }),
    undefined,
    undefined,
    params.bcc
  );
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
  bcc?: string | string[];
}

export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<EmailResult> {
  const typeLabel = params.typeLabel ?? "votre facture";
  const typeLabelCapitalized = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

  const content = `
    ${heading(`${typeLabelCapitalized} — ${params.period}`)}
    ${para("Madame, Monsieur,")}
    ${para(`Nous vous prions de bien vouloir trouver ci-joint ${typeLabel} n°&nbsp;<strong>${params.invoiceRef}</strong> concernant vos locaux pour la période de <strong>${params.period}</strong>.`)}
    ${para("Nous vous remercions de bien vouloir régler cette somme à la date d'échéance indiquée.")}
    ${para("Pour toute question relative à ce document, n'hésitez pas à nous contacter.")}
    ${para("Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.")}
    ${signature(`Le gérant — ${params.societyName}`)}
  `;

  return sendMail(
    params.to,
    `${typeLabelCapitalized} ${params.period} — ${params.invoiceRef}`,
    baseTemplate(`${typeLabelCapitalized} ${params.period}`, content, { societyName: params.societyName }),
    params.pdfAttachment ? [params.pdfAttachment] : undefined,
    undefined,
    params.bcc
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
  pdfAttachment?: { filename: string; content: Buffer };
  bcc?: string | string[];
}

export async function sendReceiptEmail(params: ReceiptEmailParams): Promise<EmailResult> {
  const content = `
    ${heading(`Quittance de loyer — ${params.period}`)}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${para("Nous accusons réception de votre paiement et vous adressons votre quittance de loyer.")}
    ${infoTable([
      { label: "Référence", value: params.invoiceRef },
      { label: "Période", value: params.period },
      { label: "Montant réglé", value: fmt(params.amount), bold: true },
      { label: "Date de paiement", value: params.paidAt },
      { label: "Statut", value: badge("Payé", "default") },
    ])}
    ${params.pdfAttachment ? para("Vous trouverez votre quittance en pièce jointe de cet email. Ce document est également disponible dans votre espace locataire.") : ""}
    ${para("Nous vous remercions de votre règlement.")}
    ${signature(params.societyName)}
  `;

  return sendMail(
    params.to,
    `Quittance de loyer ${params.period} — ${params.invoiceRef}`,
    baseTemplate(`Quittance de loyer ${params.period}`, content, { societyName: params.societyName }),
    params.pdfAttachment ? [params.pdfAttachment] : undefined,
    undefined,
    params.bcc
  );
}

// ============================================================
// CODE DE CONFIRMATION INSCRIPTION
// ============================================================

interface SignupCodeEmailParams {
  to: string;
  name: string;
  code: string;
}

export async function sendSignupCodeEmail(params: SignupCodeEmailParams): Promise<EmailResult> {
  const content = `
    ${heading("Confirmez votre inscription")}
    ${para(`Bonjour <strong>${params.name}</strong>, votre compte est presque prêt ! Saisissez le code ci-dessous pour confirmer votre adresse email et définir votre mot de passe.`)}
    ${codeBlock(params.code)}
    ${para(`Ce code est valable <strong>30 minutes</strong>.`, { muted: true })}
    ${infoBox("Après confirmation, vous pourrez créer votre profil propriétaire et commencer à gérer votre patrimoine immobilier.", "success")}
  `;

  return sendMail(params.to, `${APP_NAME} — Votre code de confirmation : ${params.code}`, baseTemplate("Confirmez votre inscription", content));
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
    ${heading(`Votre accès à ${APP_NAME}`)}
    ${para(`Bonjour <strong>${params.name}</strong>,`)}
    ${para(`Un compte a été créé pour vous sur <strong>${APP_NAME}</strong>${params.societyName ? ` pour la société <strong>${params.societyName}</strong>` : ""}.`)}
    ${para("Voici vos identifiants de connexion :")}
    ${infoTable([
      { label: "Adresse email", value: params.email },
      { label: "Mot de passe", value: `<span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:16px;font-weight:700;">${params.password}</span>`, bold: true },
    ])}
    ${ctaButton("Se connecter", params.appUrl)}
    ${infoBox("Pour des raisons de sécurité, nous vous recommandons de modifier votre mot de passe dès votre première connexion.", "warning")}
    ${signature(APP_NAME)}
  `;

  return sendMail(params.to, `Votre accès à ${APP_NAME}`, baseTemplate(`Votre accès à ${APP_NAME}`, content));
}

// ============================================================
// INVITATION NOUVEL UTILISATEUR (avec lien de creation de MDP)
// ============================================================

interface NewUserInviteEmailParams {
  to: string;
  name: string;
  email: string;
  resetUrl: string;
  appUrl: string;
  societyName?: string;
}

export async function sendNewUserInviteEmail(params: NewUserInviteEmailParams): Promise<EmailResult> {
  const content = `
    ${heading(`Bienvenue sur ${APP_NAME}`)}
    ${para(`Bonjour <strong>${params.name}</strong>,`)}
    ${para(`Un compte a été créé pour vous sur <strong>${APP_NAME}</strong>${params.societyName ? ` pour la société <strong>${params.societyName}</strong>` : ""}.`)}
    ${para("Votre adresse de connexion :")}
    ${infoTable([
      { label: "Adresse email", value: params.email },
    ])}
    ${para("Pour activer votre compte, veuillez créer votre mot de passe en cliquant sur le bouton ci-dessous :")}
    ${ctaButton("Créer mon mot de passe", params.resetUrl)}
    ${infoBox("Ce lien est valable 72 heures. Passé ce délai, demandez à votre administrateur de renvoyer une invitation.", "warning")}
    ${signature(APP_NAME)}
  `;

  return sendMail(params.to, `${APP_NAME} — Activez votre compte`, baseTemplate(`Bienvenue sur ${APP_NAME}`, content));
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
  bcc?: string | string[];
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult> {
  const content = `
    ${heading("Bienvenue dans votre nouveau logement")}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${para(`Bienvenue à <strong>${params.propertyAddress}</strong>. Voici votre récapitulatif de bail :`)}
    ${infoTable([
      { label: "Adresse", value: params.propertyAddress },
      { label: "Entrée dans les lieux", value: params.leaseStart },
      { label: "Loyer mensuel", value: fmt(params.monthlyRent), bold: true },
    ])}
    ${params.contactEmail ? para(`Contact : <a href="mailto:${params.contactEmail}" style="color:${BRAND.blue};text-decoration:none;">${params.contactEmail}</a>`) : ""}
    ${para("Nous vous souhaitons un agréable séjour.")}
    ${signature(params.societyName)}
  `;

  return sendMail(
    params.to,
    `Bienvenue — Votre bail au ${params.propertyAddress}`,
    baseTemplate("Bienvenue dans votre nouveau logement", content, { societyName: params.societyName }),
    undefined,
    undefined,
    params.bcc
  );
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
    ${heading("Activez votre espace locataire")}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${para("Votre espace locataire a été créé. Utilisez le code ci-dessous pour l'activer :")}
    ${codeBlock(params.activationCode)}
    ${ctaButton("Activer mon espace", `${params.portalUrl}/portal/activate`)}
    ${para("Ce code expire dans <strong>48 heures</strong>.", { muted: true, small: true })}
    ${signature(APP_NAME)}
  `;

  return sendMail(
    params.to,
    `Activez votre espace locataire — ${APP_NAME}`,
    baseTemplate("Activez votre espace locataire", content)
  );
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
    ${heading("Votre code de connexion")}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${para("Voici votre code de connexion à votre espace locataire :")}
    ${codeBlock(params.code)}
    ${para("Ce code expire dans <strong>15 minutes</strong>. Si vous n'avez pas demandé ce code, ignorez cet email.", { muted: true, small: true })}
    ${signature(APP_NAME)}
  `;

  return sendMail(
    params.to,
    `Code de connexion — ${APP_NAME}`,
    baseTemplate("Code de connexion", content)
  );
}

// ============================================================
// RELANCE ATTESTATION D'ASSURANCE
// ============================================================

interface InsuranceReminderEmailParams {
  to: string;
  tenantName: string;
  societyName: string;
  portalUrl: string;
  bcc?: string | string[];
}

export async function sendInsuranceReminderEmail(params: InsuranceReminderEmailParams): Promise<EmailResult> {
  const content = `
    ${heading("Attestation d'assurance requise")}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${para("Conformément à votre bail, vous devez nous fournir une <strong>attestation d'assurance</strong> en cours de validité.")}
    ${para("À ce jour, nous n'avons pas reçu ce document. Nous vous invitons à le déposer dans votre espace locataire dans les meilleurs délais.")}
    ${ctaButton("Déposer mon attestation", `${params.portalUrl}/portal/assurance`)}
    ${signature(params.societyName)}
  `;

  return sendMail(
    params.to,
    `Rappel — Attestation d'assurance requise`,
    baseTemplate("Attestation d'assurance requise", content, { societyName: params.societyName }),
    undefined,
    undefined,
    params.bcc
  );
}

// ============================================================
// DATAROOM — DOCUMENT AJOUTÉ
// ============================================================

interface DataroomDocumentAddedEmailParams {
  to: string;
  recipientName: string | null;
  dataroomName: string;
  documentName: string;
  documentCount: number;
  dataroomUrl: string;
  societyName: string;
}

export async function sendDataroomDocumentAddedEmail(params: DataroomDocumentAddedEmailParams): Promise<EmailResult> {
  const greeting = params.recipientName ? `Bonjour <strong>${params.recipientName}</strong>,` : "Bonjour,";
  const content = `
    ${heading("Nouveau document disponible")}
    ${para(greeting)}
    ${para(`Un nouveau document a été ajouté à la dataroom <strong>${params.dataroomName}</strong> qui vous a été partagée.`)}
    ${infoTable([
      { label: "Document ajouté", value: params.documentName },
      { label: "Total documents", value: String(params.documentCount) },
    ])}
    ${ctaButton("Accéder à la dataroom", params.dataroomUrl)}
    ${signature(params.societyName)}
  `;

  return sendMail(
    params.to,
    `[${params.dataroomName}] Nouveau document disponible`,
    baseTemplate("Nouveau document disponible", content, { societyName: params.societyName })
  );
}

// ============================================================
// DATAROOM — NOTIFICATION D'ACCÈS
// ============================================================

interface DataroomAccessEmailParams {
  to: string;
  dataroomName: string;
  viewerIp: string | null;
  viewerEmail: string | null;
  accessedAt: string;
  dataroomUrl: string;
}

export async function sendDataroomAccessEmail(params: DataroomAccessEmailParams): Promise<EmailResult> {
  const rows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: "Date", value: params.accessedAt },
  ];
  if (params.viewerIp) rows.push({ label: "Adresse IP", value: params.viewerIp });
  if (params.viewerEmail) rows.push({ label: "Email du visiteur", value: params.viewerEmail });

  const content = `
    ${heading("Accès à votre dataroom")}
    ${para(`Votre dataroom <strong>${params.dataroomName}</strong> vient d'être consultée.`)}
    ${infoTable(rows)}
    ${ctaButton("Voir la dataroom", params.dataroomUrl)}
    ${signature(APP_NAME)}
  `;

  return sendMail(
    params.to,
    `[Dataroom] Accès à "${params.dataroomName}"`,
    baseTemplate("Accès à votre dataroom", content)
  );
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
  bcc?: string | string[];
}

export async function sendInvoiceReminderEmail(params: InvoiceReminderEmailParams): Promise<EmailResult> {
  const content = `
    ${heading("Rappel — Facture en attente de règlement")}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${para("Nous vous informons que la facture ci-dessous est en attente de règlement :")}
    ${infoTable([
      { label: "N° Facture", value: params.invoiceNumber },
      { label: "Échéance", value: params.dueDate },
      { label: "Montant dû", value: fmt(params.amount), bold: true },
    ])}
    ${para("Si vous avez déjà effectué ce paiement, merci de ne pas tenir compte de ce message.")}
    ${signature(params.societyName)}
  `;

  return sendMail(
    params.to,
    `Rappel — Facture ${params.invoiceNumber} — ${fmt(params.amount)}`,
    baseTemplate("Rappel — Facture impayée", content, { societyName: params.societyName, borderLeftColor: BRAND.deep }),
    undefined,
    undefined,
    params.bcc
  );
}

// ============================================================
// RAPPORT CONSOLIDÉ PLANIFIÉ
// ============================================================

interface ConsolidatedReportEmailParams {
  to: string;
  scheduleName: string;
  frequencyLabel: string;
  reportLabels: string[];
  societyName: string;
  attachment: { filename: string; content: Buffer };
}

export async function sendConsolidatedReportEmail(params: ConsolidatedReportEmailParams): Promise<EmailResult> {
  const reportList = params.reportLabels.map((r) => `<li style="margin:4px 0;color:${BRAND.text};">${r}</li>`).join("");

  const content = `
    ${heading(`Rapport consolidé — ${params.frequencyLabel}`)}
    ${para(`Bonjour,`)}
    ${para(`Veuillez trouver ci-joint le rapport consolidé <strong>${params.scheduleName}</strong> pour la société <strong>${params.societyName}</strong>.`)}
    ${para("Ce rapport inclut les sections suivantes :")}
    <ul style="margin:0 0 16px;padding-left:24px;font-size:14px;">
      ${reportList}
    </ul>
    ${infoBox("Ce rapport a été généré automatiquement selon votre planification. Vous pouvez modifier ou désactiver cet envoi depuis l'onglet <strong>Rapports > Planification</strong> de votre espace.", "info")}
    ${signature(params.societyName)}
  `;

  return sendMail(
    params.to,
    `${params.scheduleName} — ${params.societyName}`,
    baseTemplate("Rapport consolidé", content, { societyName: params.societyName }),
    [params.attachment]
  );
}

// ============================================================
// REINITIALISATION MOT DE PASSE
// ============================================================

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<EmailResult> {
  const content = `
    ${heading("Réinitialisation de votre mot de passe")}
    ${para(`Bonjour <strong>${params.name}</strong>,`)}
    ${para("Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau.")}
    ${ctaButton("Réinitialiser mon mot de passe", params.resetUrl)}
    ${infoBox("Ce lien est valable <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.", "warning")}
    ${para(`Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/><a href="${params.resetUrl}" style="color:${BRAND.blue};word-break:break-all;">${params.resetUrl}</a>`, { muted: true, small: true })}
  `;

  return sendMail(
    params.to,
    `Réinitialisation de votre mot de passe — ${APP_NAME}`,
    baseTemplate("Réinitialisation de votre mot de passe", content)
  );
}

// ============================================================
// COURRIER TYPE
// ============================================================

interface SendLetterEmailParams {
  to: string;
  tenantName: string;
  subject: string;
  societyName: string;
  attachment: { filename: string; content: Buffer };
}

export async function sendLetterEmail(params: SendLetterEmailParams): Promise<EmailResult> {
  const content = `
    ${heading(params.subject)}
    ${para(`Bonjour <strong>${params.tenantName}</strong>,`)}
    ${para(`Veuillez trouver ci-joint un courrier de la part de <strong>${params.societyName}</strong>.`)}
    ${para(`Objet : <strong>${params.subject}</strong>`)}
    ${infoBox("Ce courrier est également disponible en pièce jointe au format PDF.", "info")}
    ${signature(params.societyName)}
  `;

  return sendMail(
    params.to,
    `${params.subject} — ${params.societyName}`,
    baseTemplate(params.subject, content, { societyName: params.societyName }),
    [params.attachment]
  );
}
