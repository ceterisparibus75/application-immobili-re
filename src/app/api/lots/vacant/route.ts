import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const context = await requireActiveSocietyRouteContext();
    if (context instanceof NextResponse) return context;

    const lots = await prisma.lot.findMany({
      where: { building: { societyId: context.societyId }, status: "VACANT" },
      select: {
        id: true,
        number: true,
        lotType: true,
        area: true,
        building: { select: { id: true, name: true, city: true } },
      },
      orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
    });

    return NextResponse.json({ data: lots });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Erreur serveur" } }, { status: 500 });
  }
}
