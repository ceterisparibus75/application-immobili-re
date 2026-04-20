import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (context instanceof NextResponse) {
      return NextResponse.json({
        error: {
          code: context.status === 400 ? "NO_SOCIETY" : context.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED",
          message: context.status === 400 ? "Aucune société sélectionnée" : context.status === 403 ? "Accès refusé" : "Non authentifié",
        },
      }, { status: context.status });
    }

    const { id } = await params;

    const lease = await prisma.lease.findFirst({
      where: { id, societyId: context.societyId },
    });

    if (!lease) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Bail introuvable" } }, { status: 404 });
    }

    return NextResponse.json({ data: lease });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Erreur serveur" } }, { status: 500 });
  }
}
