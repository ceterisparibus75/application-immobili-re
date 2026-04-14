import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { buildPain001Xml, type SepaCreditTransferInput } from "@/lib/sepa-credit-transfer";
import { decrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  // ── Authentification session NextAuth ────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // ── Récupérer le societyId depuis le header injecté par le middleware ────
  const societyId = request.headers.get("x-society-id");
  if (!societyId) {
    return NextResponse.json({ error: "Société non identifiée" }, { status: 400 });
  }

  // ── Récupérer la facture et la société ───────────────────────────────────
  const [invoice, society] = await Promise.all([
    prisma.supplierInvoice.findFirst({
      where: { id, societyId },
      select: {
        id: true,
        societyId: true,
        status: true,
        supplierIbanEncrypted: true,
        supplierBic: true,
        supplierName: true,
        amountTTC: true,
        dueDate: true,
        invoiceNumber: true,
        reference: true,
        description: true,
      },
    }),
    prisma.society.findUnique({
      where: { id: societyId },
      select: {
        id: true,
        name: true,
        ibanEncrypted: true,
        bicEncrypted: true,
      },
    }),
  ]);

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  // ── Vérifications métier ─────────────────────────────────────────────────
  if (invoice.status !== "VALIDATED") {
    return NextResponse.json(
      { error: "Seules les factures validées peuvent générer un virement SEPA" },
      { status: 422 }
    );
  }

  if (!invoice.supplierIbanEncrypted) {
    return NextResponse.json(
      { error: "L'IBAN du fournisseur est manquant. Veuillez renseigner l'IBAN avant de générer le virement." },
      { status: 422 }
    );
  }

  if (!society?.ibanEncrypted) {
    return NextResponse.json(
      { error: "L'IBAN de la société débitrice est manquant. Veuillez renseigner l'IBAN de votre société." },
      { status: 422 }
    );
  }

  if (invoice.amountTTC == null || invoice.amountTTC <= 0) {
    return NextResponse.json(
      { error: "Le montant TTC est invalide ou manquant" },
      { status: 422 }
    );
  }

  if (!invoice.supplierName) {
    return NextResponse.json(
      { error: "Le nom du fournisseur est requis pour générer le virement SEPA" },
      { status: 422 }
    );
  }

  // ── Déchiffrer les IBANs ─────────────────────────────────────────────────
  let creditorIban: string;
  let debtorIban: string;
  let debtorBic: string | undefined;

  try {
    creditorIban = decrypt(invoice.supplierIbanEncrypted);
  } catch (err) {
    console.error("[sepa-xml] Déchiffrement IBAN fournisseur échoué", err);
    return NextResponse.json(
      { error: "Impossible de déchiffrer l'IBAN du fournisseur" },
      { status: 500 }
    );
  }

  try {
    debtorIban = decrypt(society.ibanEncrypted);
  } catch (err) {
    console.error("[sepa-xml] Déchiffrement IBAN société échoué", err);
    return NextResponse.json(
      { error: "Impossible de déchiffrer l'IBAN de la société" },
      { status: 500 }
    );
  }

  if (society.bicEncrypted) {
    try {
      debtorBic = decrypt(society.bicEncrypted);
    } catch {
      // BIC non obligatoire — on continue sans
      debtorBic = undefined;
    }
  }

  // ── Calculer la date d'exécution ─────────────────────────────────────────
  let executionDate: string;
  if (invoice.dueDate) {
    executionDate = invoice.dueDate.toISOString().slice(0, 10);
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    executionDate = tomorrow.toISOString().slice(0, 10);
  }

  // ── Construire les identifiants SEPA ────────────────────────────────────
  const endToEndId = (invoice.invoiceNumber ?? invoice.reference ?? invoice.id).slice(0, 35);
  const remittanceInfo = `Facture ${invoice.supplierName} ${invoice.invoiceNumber ?? ""}`.slice(0, 140).trim();
  const msgId = invoice.id.slice(0, 35);

  const sepaInput: SepaCreditTransferInput = {
    msgId,
    debtorName: society.name,
    debtorIban,
    debtorBic,
    creditorName: invoice.supplierName,
    creditorIban,
    creditorBic: invoice.supplierBic ?? undefined,
    amount: invoice.amountTTC,
    currency: "EUR",
    executionDate,
    endToEndId,
    remittanceInfo,
  };

  // ── Générer le XML PAIN.001 ───────────────────────────────────────────────
  const xmlString = buildPain001Xml(sepaInput);

  // ── Upload XML dans Supabase Storage ─────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
      const xmlStoragePath = `documents/${societyId}/supplier-invoices/sepa/${invoice.id}.xml`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(xmlStoragePath, Buffer.from(xmlString, "utf-8"), {
          contentType: "application/xml",
          upsert: true,
        });

      if (uploadError) {
        console.error("[sepa-xml] Upload XML Supabase échoué", uploadError);
      } else {
        // Mettre à jour la facture avec les infos de paiement SEPA
        await prisma.supplierInvoice.update({
          where: { id },
          data: {
            sepaXmlStoragePath: xmlStoragePath,
            sepaXmlUrl: xmlStoragePath,
            paymentMethod: "SEPA_XML",
            paymentStatus: "SUBMITTED",
          },
        });
      }
    } catch (storageErr) {
      console.error("[sepa-xml] Erreur stockage XML", storageErr);
      // On continue et on retourne quand même le XML au client
    }
  }

  // ── Retourner le fichier XML téléchargeable ───────────────────────────────
  const downloadFilename = `virement-${invoice.invoiceNumber ?? invoice.id}.xml`;

  return new Response(xmlString, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename}"`,
      "Cache-Control": "no-store",
    },
  });
}
