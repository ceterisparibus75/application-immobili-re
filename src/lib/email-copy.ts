import { prisma } from "@/lib/prisma";

/**
 * Récupère l'adresse BCC de l'utilisateur qui a activé la copie email
 * pour une société donnée. Retourne null si désactivé.
 */
export async function getEmailCopyBcc(societyId: string): Promise<string | null> {
  // Trouver tous les utilisateurs de cette société qui ont activé la copie
  const users = await prisma.userSociety.findMany({
    where: { societyId },
    include: {
      user: {
        select: {
          email: true,
          emailCopyEnabled: true,
          emailCopyAddress: true,
        },
      },
    },
  });

  const bccAddresses: string[] = [];
  for (const us of users) {
    if (us.user.emailCopyEnabled) {
      const addr = us.user.emailCopyAddress || us.user.email;
      if (addr) bccAddresses.push(addr);
    }
  }

  return bccAddresses.length > 0 ? bccAddresses[0] : null;
}

/**
 * Récupère toutes les adresses BCC pour une société (si plusieurs utilisateurs ont activé)
 */
export async function getAllEmailCopyBcc(societyId: string): Promise<string[]> {
  const users = await prisma.userSociety.findMany({
    where: { societyId },
    include: {
      user: {
        select: {
          email: true,
          emailCopyEnabled: true,
          emailCopyAddress: true,
        },
      },
    },
  });

  const bccAddresses: string[] = [];
  for (const us of users) {
    if (us.user.emailCopyEnabled) {
      const addr = us.user.emailCopyAddress || us.user.email;
      if (addr) bccAddresses.push(addr);
    }
  }

  return bccAddresses;
}
