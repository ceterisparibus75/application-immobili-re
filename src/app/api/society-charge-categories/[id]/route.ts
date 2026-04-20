import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (context instanceof NextResponse) return context;
    const cat = await prisma.societyChargeCategory.findFirst({ where: { id, societyId: context.societyId } });
    if (!cat) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ data: cat });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
