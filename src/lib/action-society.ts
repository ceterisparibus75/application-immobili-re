import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";

export class UnauthenticatedActionError extends Error {
  constructor(message = "Non authentifié") {
    super(message);
    this.name = "UnauthenticatedActionError";
  }
}

export type SocietyActionContext = {
  userId: string;
  societyId: string;
};

/**
 * Helper partagé pour les Server Actions qui opèrent dans le scope
 * d'une société explicite.
 */
export async function requireSocietyActionContext(
  societyId: string,
  minRole?: UserRole
): Promise<SocietyActionContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthenticatedActionError();
  }

  await requireSocietyAccess(session.user.id, societyId, minRole);

  return {
    userId: session.user.id,
    societyId,
  };
}

export async function getOptionalSocietyActionContext(
  societyId: string,
  minRole?: UserRole
): Promise<SocietyActionContext | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  try {
    await requireSocietyAccess(session.user.id, societyId, minRole);
  } catch {
    return null;
  }

  return {
    userId: session.user.id,
    societyId,
  };
}
