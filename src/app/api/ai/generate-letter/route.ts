import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { generateLetter, type LetterGenerationInput } from "@/lib/ai-letter-generator";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune société sélectionnée" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const body = (await req.json()) as LetterGenerationInput;
    if (!body.letterType || !body.description || !body.context) {
      return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
    }

    const letter = await generateLetter(body);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "AILetter",
      entityId: "generated",
      details: { letterType: body.letterType, tone: letter.tone },
    });

    return NextResponse.json({ letter });
  } catch (error) {
    console.error("[AI Letter]", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
