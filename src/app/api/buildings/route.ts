import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const context = await requireActiveSocietyRouteContext();
    if (context instanceof NextResponse) return context;

    const buildings = await prisma.building.findMany({
      where: { societyId: context.societyId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: buildings });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Erreur serveur" } }, { status: 500 });
  }
}
