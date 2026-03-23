import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) return NextResponse.json({ error: "Société non sélectionnée" }, { status: 400 });
    await requireSocietyAccess(session.user.id, societyId);
    const cat = await prisma.societyChargeCategory.findFirst({ where: { id, societyId } });
    if (!cat) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ data: cat });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
