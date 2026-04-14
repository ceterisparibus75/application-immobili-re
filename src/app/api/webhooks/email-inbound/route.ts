import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

interface InboundAttachment {
  filename: string;
  content: string;        // Base64
  content_type: string;
}

interface InboundEmailPayload {
  to: string | string[];
  from: string;
  subject: string;
  attachments?: InboundAttachment[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();

    let payload: InboundEmailPayload;
    try {
      payload = JSON.parse(rawBody) as InboundEmailPayload;
    } catch {
      console.error("[email-inbound] Payload JSON invalide");
      return NextResponse.json({ ok: true });
    }

    const { to, from, subject, attachments } = payload;

    // Extraire l'adresse email destinataire
    const toEmail = Array.isArray(to) ? to[0] : to;
    if (!toEmail || typeof toEmail !== "string") {
      return NextResponse.json({ ok: true });
    }

    // Chercher la config de boîte aux lettres active
    const config = await prisma.supplierInboxConfig.findFirst({
      where: {
        inboxEmail: toEmail,
        isActive: true,
      },
    });

    if (!config) {
      // ACK sans traitement — boîte non configurée ou inactive
      return NextResponse.json({ ok: true });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("[email-inbound] Supabase non configuré");
      return NextResponse.json({ ok: true });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    const pdfAttachments = (attachments ?? []).filter(
      (a) => a.content_type === "application/pdf"
    );

    let receivedCount = 0;

    for (const attachment of pdfAttachments) {
      try {
        const buffer = Buffer.from(attachment.content, "base64");
        const safeName = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `documents/${config.societyId}/supplier-invoices/${Date.now()}_${safeName}`;

        // Upload dans Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, buffer, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          console.error("[email-inbound] Upload Supabase échoué", uploadError);
          continue;
        }

        // Créer l'entrée SupplierInvoice en base
        const invoice = await prisma.supplierInvoice.create({
          data: {
            societyId: config.societyId,
            fileName: attachment.filename,
            fileUrl: storagePath,
            storagePath,
            fileSize: buffer.length,
            mimeType: "application/pdf",
            status: "PENDING_REVIEW",
            source: "email_inbound",
            senderEmail: from,
            emailSubject: subject,
            receivedAt: new Date(),
            aiStatus: "pending",
            reference: `FINV-${Date.now()}`,
          },
        });

        // Déclencher l'analyse IA en arrière-plan (fire-and-forget)
        const appUrl = process.env.AUTH_URL ?? "";
        const cronSecret = process.env.CRON_SECRET ?? "";
        if (appUrl && cronSecret) {
          fetch(`${appUrl}/api/supplier-invoices/${invoice.id}/analyze`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cronSecret}`,
              "Content-Type": "application/json",
            },
          }).catch((err) => {
            console.error("[email-inbound] Déclenchement analyse IA échoué", err);
          });
        }

        receivedCount++;
      } catch (attachErr) {
        console.error("[email-inbound] Erreur traitement pièce jointe", attachErr);
      }
    }

    // Notification email si des destinataires sont configurés
    if (
      receivedCount > 0 &&
      Array.isArray((config as { notifyEmails?: unknown }).notifyEmails) &&
      ((config as { notifyEmails?: unknown[] }).notifyEmails ?? []).length > 0
    ) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY ?? "");
        const notifyEmails = (config as { notifyEmails: string[] }).notifyEmails;
        await resend.emails.send({
          from: `"${process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia"}" <${process.env.EMAIL_FROM ?? "noreply@mygestia.immo"}>`,
          to: notifyEmails,
          subject: `[${process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia"}] ${receivedCount} facture(s) reçue(s) par email`,
          html: `<p>Vous avez reçu ${receivedCount} nouvelle(s) facture(s) fournisseur via l'adresse <strong>${toEmail}</strong>.</p><p>Expéditeur : ${from}<br/>Sujet : ${subject}</p>`,
        });
      } catch (mailErr) {
        console.error("[email-inbound] Notification email échouée", mailErr);
      }
    }

    return NextResponse.json({ ok: true, received: receivedCount });
  } catch (err) {
    console.error("[email-inbound] Erreur générale", err);
    // On ne fait jamais échouer un webhook
    return NextResponse.json({ ok: true });
  }
}
