import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
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

    const lots = await prisma.lot.findMany({
      where: { building: { societyId }, status: "VACANT" },
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
