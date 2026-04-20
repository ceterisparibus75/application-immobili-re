import { NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (context instanceof NextResponse) return context;
    const categories = await prisma.societyChargeCategory.findMany({
      where: {
        OR: [
          { societyId: context.societyId },
          { societyId: null, isGlobal: true },
        ],
        isActive: true,
      },
      orderBy: [{ isGlobal: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ data: categories });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
