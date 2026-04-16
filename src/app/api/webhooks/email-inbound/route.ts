import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/* ─── Types Resend Inbound ─────────────────────────────────────────────── */

interface ResendAttachmentMeta {
  id?: string;
  filename: string;
  content_type: string;
  content_length?: number;
  content_id?: string | null;
  expires_at?: string;
  download_url?: string;
}

interface ResendEmailReceivedEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    attachments?: ResendAttachmentMeta[];
  };
}

/* ─── Helper : extraire l'adresse email d'un champ "Nom <email>" ─────── */

function extractEmail(field: string): string {
  const match = field.match(/<([^>]+)>/);
  return match ? match[1].trim() : field.trim();
}

/* ─── Route POST ─────────────────────────────────────────────────────── */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();

    let event: ResendEmailReceivedEvent;
    try {
      event = JSON.parse(rawBody) as ResendEmailReceivedEvent;
    } catch {
      console.error("[email-inbound] Payload JSON invalide");
      return NextResponse.json({ ok: true });
    }

    if (event.type !== "email.received") {
      return NextResponse.json({ ok: true });
    }

    const { email_id, from, to, subject, attachments: attachmentsMeta } = event.data;

    // Extraire le destinataire
    const toEmail = Array.isArray(to) ? to[0] : to;
    if (!toEmail || typeof toEmail !== "string") {
      return NextResponse.json({ ok: true });
    }

    // Chercher la config active pour cet email
    const config = await prisma.supplierInboxConfig.findFirst({
      where: { inboxEmail: toEmail, isActive: true },
    });

    if (!config) {
      return NextResponse.json({ ok: true });
    }

    // Vérifier qu'il y a des pièces jointes PDF dans les métadonnées
    const pdfMeta = (attachmentsMeta ?? []).filter(
      (a) => a.content_type === "application/pdf"
    );

    if (pdfMeta.length === 0) {
      return NextResponse.json({ ok: true, received: 0 });
    }

    // Initialiser les clients
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[email-inbound] RESEND_API_KEY non configuré");
      return NextResponse.json({ ok: true });
    }
    const resend = new Resend(apiKey);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("[email-inbound] Supabase non configuré");
      return NextResponse.json({ ok: true });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    // Récupérer les URLs de téléchargement via l'API Resend
    const { data: attachmentListResponse } = await resend.emails.receiving.attachments.list({
      emailId: email_id,
    });

    const downloadableAttachments: ResendAttachmentMeta[] =
      (attachmentListResponse as { data?: ResendAttachmentMeta[] } | null)?.data ?? [];

    let receivedCount = 0;

    for (const meta of pdfMeta) {
      try {
        // Trouver la pièce jointe avec son download_url
        const attachmentInfo = downloadableAttachments.find(
          (a) => a.filename === meta.filename
        ) ?? downloadableAttachments.find(
          (a) => a.content_type === "application/pdf"
        );

        if (!attachmentInfo?.download_url) {
          console.error("[email-inbound] Pas de download_url pour", meta.filename);
          continue;
        }

        // Télécharger le contenu
        const dlRes = await fetch(attachmentInfo.download_url);
        if (!dlRes.ok) {
          console.error("[email-inbound] Téléchargement échoué", meta.filename, dlRes.status);
          continue;
        }
        const buffer = Buffer.from(await dlRes.arrayBuffer());

        const safeName = meta.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
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

        // Créer la facture en base
        const invoice = await prisma.supplierInvoice.create({
          data: {
            societyId: config.societyId,
            fileName: meta.filename,
            fileUrl: storagePath,
            storagePath,
            fileSize: buffer.length,
            mimeType: "application/pdf",
            status: "PENDING_REVIEW",
            source: "email_inbound",
            senderEmail: extractEmail(from),
            emailSubject: subject,
            receivedAt: new Date(),
            aiStatus: "pending",
            reference: `FINV-${Date.now()}`,
          },
        });

        // Déclencher l'analyse IA en arrière-plan
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
        const notifyEmails = (config as { notifyEmails: string[] }).notifyEmails;
        await resend.emails.send({
          from: `"${process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia"}" <${process.env.EMAIL_FROM ?? "noreply@mygestia.immo"}>`,
          to: notifyEmails,
          subject: `[${process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia"}] ${receivedCount} facture(s) reçue(s) par email`,
          html: `<p>Vous avez reçu ${receivedCount} nouvelle(s) facture(s) fournisseur via l'adresse <strong>${toEmail}</strong>.</p><p>Expéditeur : ${extractEmail(from)}<br/>Sujet : ${subject}</p>`,
        });
      } catch (mailErr) {
        console.error("[email-inbound] Notification email échouée", mailErr);
      }
    }

    return NextResponse.json({ ok: true, received: receivedCount });
  } catch (err) {
    console.error("[email-inbound] Erreur générale", err);
    // Ne jamais faire échouer un webhook
    return NextResponse.json({ ok: true });
  }
}
