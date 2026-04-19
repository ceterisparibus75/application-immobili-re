"use server";

import { z } from "zod";
import { Resend } from "resend";
import { redirect } from "next/navigation";

const contactSchema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  society: z.string().min(2, "Société requise"),
  portfolioSize: z.enum(["<10", "10-50", "50-200", "200+"], {
    errorMap: () => ({ message: "Taille du portefeuille requise" }),
  }),
  plan: z.enum(["essentiel", "professionnel", "institutionnel", "unknown"], {
    errorMap: () => ({ message: "Plan requis" }),
  }),
  message: z.string().min(10, "Message trop court (10 caractères minimum)"),
  rgpd: z.literal("on", { errorMap: () => ({ message: "Vous devez accepter la politique de confidentialité" }) }),
});

const PLAN_LABELS: Record<string, string> = {
  essentiel: "Essentiel — 19€/mois",
  professionnel: "Professionnel — 79€/mois",
  institutionnel: "Institutionnel — 199€/mois",
  unknown: "Je ne sais pas encore",
};

const PORTFOLIO_LABELS: Record<string, string> = {
  "<10": "Moins de 10 lots",
  "10-50": "10 à 50 lots",
  "50-200": "50 à 200 lots",
  "200+": "Plus de 200 lots",
};

export async function sendContactEmail(
  _prevState: { success: boolean; error?: string },
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const raw = {
    firstName: formData.get("firstName"),
    name: formData.get("name"),
    email: formData.get("email"),
    society: formData.get("society"),
    portfolioSize: formData.get("portfolioSize"),
    plan: formData.get("plan"),
    message: formData.get("message"),
    rgpd: formData.get("rgpd"),
  };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(". "),
    };
  }

  const { firstName, name, email, society, portfolioSize, plan, message } = parsed.data;

  if (!process.env.RESEND_API_KEY) {
    console.error("[sendContactEmail] RESEND_API_KEY manquant");
    return { success: false, error: "Service email non configuré. Réessayez plus tard." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = `"MyGestia Contact" <${process.env.EMAIL_FROM ?? "noreply@mygestia.immo"}>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><title>Nouveau contact MyGestia</title></head>
<body style="font-family:Inter,sans-serif;background:#F9FAFB;padding:32px 16px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #E2E8F0;">
    <h1 style="font-size:22px;font-weight:700;color:#0C2340;margin:0 0 8px;">Nouvelle demande de contact</h1>
    <p style="color:#64748B;font-size:14px;margin:0 0 28px;">Reçu depuis le formulaire mygestia.immo/contact</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;width:40%;">Nom</td>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-weight:600;">${firstName} ${name}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;">Email</td>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-weight:600;">${email}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;">Société</td>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-weight:600;">${society}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;">Portefeuille</td>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-weight:600;">${PORTFOLIO_LABELS[portfolioSize]}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;">Plan d'intérêt</td>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-weight:600;">${PLAN_LABELS[plan]}</td>
      </tr>
    </table>

    <div style="margin-top:24px;">
      <p style="font-size:13px;color:#64748B;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
      <div style="background:#F8FAFC;border-radius:6px;padding:16px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${message}</div>
    </div>

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #F1F5F9;">
      <a href="mailto:${email}" style="display:inline-block;background:linear-gradient(135deg,#1B4F8A,#22B8CF);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Répondre à ${firstName}
      </a>
    </div>
  </div>
</body>
</html>`;

  try {
    const to = process.env.EMAIL_CONTACT ?? process.env.EMAIL_FROM ?? "contact@mygestia.immo";

    await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `[MyGestia] Demande de ${firstName} ${name} — ${PLAN_LABELS[plan]}`,
      html,
    });
  } catch (error) {
    console.error("[sendContactEmail]", error);
    return { success: false, error: "Erreur lors de l'envoi. Réessayez ou écrivez à contact@mygestia.immo." };
  }

  redirect("/contact/merci");
}
