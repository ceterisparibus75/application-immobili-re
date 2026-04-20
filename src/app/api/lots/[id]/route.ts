import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireActiveSocietyRouteContext();
    if (context instanceof NextResponse) return context;

    const lot = await prisma.lot.findFirst({
      where: { id, building: { societyId: context.societyId } },
    });

    if (!lot) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Lot introuvable" } }, { status: 404 });
    }

    return NextResponse.json({ data: lot });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Erreur serveur" } }, { status: 500 });
  }
}
