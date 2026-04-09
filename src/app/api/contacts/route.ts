import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import type { ContactType } from "@/generated/prisma/client";

const VALID_TYPES: Set<string> = new Set([
  "LOCATAIRE", "PRESTATAIRE", "NOTAIRE", "EXPERT", "SYNDIC", "AGENCE", "AUTRE",
]);

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune société sélectionnée" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId);

    const typeParam = req.nextUrl.searchParams.get("type");
    const where: Record<string, unknown> = { societyId, isActive: true };

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
