import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifié" } }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;

    if (!societyId) {
      return NextResponse.json({ error: { code: "NO_SOCIETY", message: "Aucune société sélectionnée" } }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId);

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
        societyId,
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
