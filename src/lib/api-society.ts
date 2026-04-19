import { UserRole } from "@/generated/prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ForbiddenError, requireSocietyAccess } from "@/lib/permissions";

export type ActiveSocietyRouteContext = {
  societyId: string;
  userId: string;
};

type RequireActiveSocietyOptions = {
  minRole?: UserRole;
  societyId?: string | null;
};

/**
 * Standardise l'accès aux routes liées à la société active afin d'éviter
 * les oublis de vérification d'appartenance/permissions.
 */
export async function requireActiveSocietyRouteContext(
  options: RequireActiveSocietyOptions = {}
): Promise<ActiveSocietyRouteContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const societyId =
    options.societyId ?? cookieStore.get("active-society-id")?.value ?? null;

  if (!societyId) {
    return NextResponse.json(
      { error: "Société non sélectionnée" },
      { status: 400 }
    );
  }

  try {
    await requireSocietyAccess(session.user.id, societyId, options.minRole);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  return {
    societyId,
    userId: session.user.id,
  };
}
