import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

/**
 * GET /api/users?societyId=xxx
 * Retourne le nombre de membres d'une société (pour le check onboarding).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = await requireActiveSocietyRouteContext({
    societyId: searchParams.get("societyId"),
  });
  if (context instanceof NextResponse) {
    if (context.status === 400) {
      return NextResponse.json({ data: [] });
    }
    return context;
  }

  const { societyId } = context;

  const members = await prisma.userSociety.findMany({
    where: { societyId },
    select: { userId: true },
  });

  return NextResponse.json({ data: members });
}
