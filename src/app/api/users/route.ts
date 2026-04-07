import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";

/**
 * GET /api/users?societyId=xxx
 * Retourne le nombre de membres d'une société (pour le check onboarding).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let societyId = searchParams.get("societyId");

  if (!societyId) {
    const cookieStore = await cookies();
    societyId = cookieStore.get("active-society-id")?.value ?? null;
  }

  if (!societyId) {
    return NextResponse.json({ data: [] });
  }

  // P1 security: verify the user belongs to this society before listing members
  try {
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const members = await prisma.userSociety.findMany({
    where: { societyId },
    select: { userId: true },
  });

  return NextResponse.json({ data: members });
}
