import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifié" } }, { status: 401 });
    }

    const { id } = await params;
    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;

    if (!societyId) {
      return NextResponse.json({ error: { code: "NO_SOCIETY", message: "Aucune société sélectionnée" } }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId);

    const lot = await prisma.lot.findFirst({
      where: { id, building: { societyId } },
    });

    if (!lot) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Lot introuvable" } }, { status: 404 });
    }

    return NextResponse.json({ data: lot });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Erreur serveur" } }, { status: 500 });
  }
}
