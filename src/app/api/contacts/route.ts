import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ContactType } from "@/generated/prisma/client";

const VALID_TYPES: Set<string> = new Set([
  "LOCATAIRE", "PRESTATAIRE", "NOTAIRE", "EXPERT", "SYNDIC", "AGENCE", "AUTRE",
]);

export async function GET(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext();
    if (context instanceof NextResponse) return context;

    const typeParam = req.nextUrl.searchParams.get("type");
    const where: Record<string, unknown> = { societyId: context.societyId, isActive: true };

    if (typeParam && VALID_TYPES.has(typeParam)) {
      where.contactType = typeParam as ContactType;
    }

    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true, name: true, company: true, email: true, phone: true, contactType: true },
      orderBy: [{ name: "asc" }],
    });

    return NextResponse.json({ data: contacts });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
