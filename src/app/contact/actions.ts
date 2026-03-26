"use server";
import { z } from "zod";
import { Resend } from "resend";

const contactSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  subject: z.string().min(3, "Objet requis"),
  message: z.string().min(10, "Message trop court"),
});

export async function sendContactEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { name, email, subject, message } = parsed.data;

    if (!process.env.RESEND_API_KEY) {
      console.error("[sendContactEmail] RESEND_API_KEY manquant");
      return { success: false, error: "Service email non configure" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM ?? "noreply@mtggroupe.org";
    const to = process.env.EMAIL_CONTACT ?? process.env.EMAIL_FROM ?? "contact@mtggroupe.org";

    await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      html: `
        <h2>Nouveau message de contact</h2>
        <p><strong>De :</strong> ${name} (&lt;${email}&gt;)</p>
        <p><strong>Objet :</strong> ${subject}</p>
        <hr />
        <pre style="font-family:inherit;white-space:pre-wrap">${message}</pre>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("[sendContactEmail]", error);
    return { success: false, error: "Erreur lors de l'envoi" };
  }
}
