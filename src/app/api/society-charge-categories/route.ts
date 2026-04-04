import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) return NextResponse.json({ error: "Société non sélectionnée" }, { status: 400 });
    await requireSocietyAccess(session.user.id, societyId);
    const categories = await prisma.societyChargeCategory.findMany({
      where: {
        OR: [
          { societyId },
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
