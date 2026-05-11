import { compareSync } from "bcryptjs";
import { prisma } from "./prisma";
import { createAuditLogsForUserSocieties } from "./audit";

export const ACCOUNT_LOCK_THRESHOLD = 5;
export const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

export type AuthorizeResult =
  | null
  | {
      id: string;
      email: string;
      name: string;
      image: string | null;
      requires2FA?: true;
    };

/**
 * Vérifie les credentials, gère le verrouillage de compte (5 échecs → 15 min),
 * journalise les évènements LOGIN_FAILED / ACCOUNT_LOCKED / LOGIN_SUCCESS.
 * Extrait du provider `Credentials` pour rester testable en isolation.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password", unknown>> | undefined,
): Promise<AuthorizeResult> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const email = credentials.email as string;
  const password = credentials.password as string;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userSocieties: {
          include: { society: { select: { id: true, name: true } } },
        },
      },
    });
  } catch (err) {
    console.error("[auth] DB error:", err);
    return null;
  }

  if (!user || !user.isActive) {
    return null;
  }

  if (user.lockedUntil && new Date() < user.lockedUntil) {
    return null;
  }

  const isPasswordValid = compareSync(password, user.passwordHash);
  if (!isPasswordValid) {
    try {
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          ...(newAttempts >= ACCOUNT_LOCK_THRESHOLD
            ? { lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS) }
            : {}),
        },
      });
      await createAuditLogsForUserSocieties({
        societyIds: user.userSocieties.map((membership) => membership.societyId),
        userId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        details: {
          event: newAttempts >= ACCOUNT_LOCK_THRESHOLD ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
          email: user.email,
          failedLoginAttempts: newAttempts,
        },
      });
    } catch (err) {
      console.error("[auth] update failedLoginAttempts error:", err);
    }
    return null;
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    if (!user.twoFactorEnabled) {
      await createAuditLogsForUserSocieties({
        societyIds: user.userSocieties.map((membership) => membership.societyId),
        userId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        details: {
          event: "LOGIN_SUCCESS",
          email: user.email,
        },
      });
    }
  } catch (err) {
    console.error("[auth] update lastLoginAt error:", err);
  }

  if (user.twoFactorEnabled) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? user.firstName ?? user.email,
      image: user.image,
      requires2FA: true,
    };
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.firstName ?? user.email,
    image: user.image,
  };
}
