import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { analyzeSupplierInvoice } from "@/lib/supplier-invoice-ai";
import { encrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // ── Authentification : Bearer CRON_SECRET OU session NextAuth ────────────
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall =
    cronSecret !== undefined &&
    cronSecret !== "" &&
    authHeader === `Bearer ${cronSecret}`;

  let sessionSocietyId: string | undefined;

  if (!isCronCall) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    // Récupérer le societyId depuis le cookie injecté par le middleware
    const societyIdHeader = request.headers.get("x-society-id");
    sessionSocietyId = societyIdHeader ?? undefined;
  }

  // ── Récupérer la facture ───────────────────────────────────────────────────
  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      societyId: true,
      storagePath: true,
      mimeType: true,
      supplierName: true,
      amountTTC: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  // Vérifier que la session a accès à cette société (si appel depuis session)
  if (!isCronCall && sessionSocietyId && invoice.societyId !== sessionSocietyId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Stockage non configuré" },
      { status: 503 }
    );
  }

  // ── Marquer comme en cours d'analyse ─────────────────────────────────────
  await prisma.supplierInvoice.update({
    where: { id },
    data: { aiStatus: "pending" },
  });

  try {
    // ── Télécharger le PDF depuis Supabase Storage ────────────────────────
    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(invoice.storagePath);

    if (downloadError || !fileData) {
      console.error("[analyze] Téléchargement PDF échoué", downloadError);
      await prisma.supplierInvoice.update({
        where: { id },
        data: { aiStatus: "error" },
      });
      return NextResponse.json(
        { error: "Impossible de télécharger le PDF" },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Analyse IA ────────────────────────────────────────────────────────
    const result = await analyzeSupplierInvoice(buffer, invoice.mimeType ?? "application/pdf");

    // ── Chiffrer l'IBAN si présent ────────────────────────────────────────
    let supplierIbanEncrypted: string | null = null;
    if (result.supplierIban) {
      supplierIbanEncrypted = encrypt(result.supplierIban);
    }

    // ── Persister les données extraites ───────────────────────────────────
    await prisma.supplierInvoice.update({
      where: { id },
      data: {
        supplierName: result.supplierName ?? undefined,
        supplierSiret: result.supplierSiret ?? undefined,
        supplierAddress: result.supplierAddress ?? undefined,
        supplierIbanEncrypted: supplierIbanEncrypted ?? undefined,
        supplierBic: result.supplierBic ?? undefined,
        invoiceNumber: result.invoiceNumber ?? undefined,
        invoiceDate: result.invoiceDate ? new Date(result.invoiceDate) : undefined,
        dueDate: result.dueDate ? new Date(result.dueDate) : undefined,
        amountHT: result.amountHT ?? undefined,
        amountVAT: result.amountVAT ?? undefined,
        amountTTC: result.amountTTC ?? undefined,
        vatRate: result.vatRate ?? undefined,
        currency: result.currency,
        description: result.description ?? undefined,
        periodStart: result.periodStart ? new Date(result.periodStart) : undefined,
        periodEnd: result.periodEnd ? new Date(result.periodEnd) : undefined,
        aiConfidence: result.confidence,
        aiAnalyzedAt: new Date(),
        aiStatus: "done",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aiRawMetadata: result as any,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        invoiceId: id,
        aiStatus: "done",
        supplierName: result.supplierName,
        amountTTC: result.amountTTC,
      },
    });
  } catch (err) {
    console.error("[analyze] Erreur analyse IA", err);
    await prisma.supplierInvoice.update({
      where: { id },
      data: { aiStatus: "error" },
    }).catch(() => undefined);

    return NextResponse.json(
      { error: "Erreur lors de l'analyse IA" },
      { status: 500 }
    );
  }
}
