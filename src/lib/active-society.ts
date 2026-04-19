import { UserRole } from "@/generated/prisma/client";
import { cookies } from "next/headers";
import { ForbiddenError, requireSocietyAccess } from "@/lib/permissions";

/**
 * Retourne la société active si elle existe et si l'utilisateur y a bien accès.
 * Renvoie `null` si aucune société n'est sélectionnée ou si l'accès est refusé.
 */
export async function getOptionalAccessibleActiveSocietyId(
  userId: string,
  minRole?: UserRole
): Promise<string | null> {
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;

  if (!societyId) {
    return null;
  }

  try {
    await requireSocietyAccess(userId, societyId, minRole);
    return societyId;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return null;
    }
    throw error;
  }
}
