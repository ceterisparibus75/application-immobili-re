import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext();
    if (context instanceof NextResponse) return context;

    const { searchParams } = new URL(req.url);
    const buildingId = searchParams.get("buildingId");

    // Validate buildingId format if provided
    if (buildingId && !/^c[a-z0-9]{24,}$/.test(buildingId)) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAM", message: "buildingId invalide" } },
        { status: 400 }
      );
    }

    const categories = await prisma.chargeCategory.findMany({
      where: {
        societyId: context.societyId,
        ...(buildingId ? { buildingId } : {}),
      },
      select: { id: true, name: true, nature: true, allocationMethod: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: categories });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Erreur serveur" } }, { status: 500 });
  }
}
