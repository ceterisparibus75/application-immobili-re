import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { parsePdfBankStatement } from "@/lib/pdf-bank-parser";

// Limite à 20 Mo pour les PDF de relevés bancaires
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json(
        { error: "Aucune société sélectionnée" },
        { status: 400 }
      );
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "L'analyse IA n'est pas configurée sur ce serveur" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Seuls les fichiers PDF sont acceptés" },
        { status: 400 }
      );
    }

    // Limite 20 Mo
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Le fichier dépasse la limite de 20 Mo" },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rows = await parsePdfBankStatement(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune transaction trouvée dans ce PDF. Vérifiez que le document est bien un relevé bancaire." },
        { status: 422 }
      );
    }

    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'analyse";
    console.error("[parse-pdf]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
