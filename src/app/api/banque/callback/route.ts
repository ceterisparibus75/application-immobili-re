import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Callback Powens Open Banking (PSD2).
 * Powens redirige ici apres que l'utilisateur a autorise l'acces a sa banque.
 * URL : ?connection_id=XXX&state=BankConnection.id
 *
 * Sécurisé : vérifie que l'utilisateur authentifié est propriétaire de la connexion.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const powensConnectionId = searchParams.get("connection_id");

  if (!state) {
    redirect("/banque?error=missing_state");
  }

  // Vérifier l'authentification
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=" + encodeURIComponent(request.url));
  }

  try {
    // Vérifier que la connexion appartient à une société de l'utilisateur
    const bankConnection = await prisma.bankConnection.findUnique({
      where: { id: state },
      select: { societyId: true },
    });

    if (!bankConnection) {
      redirect("/banque?error=connection_not_found");
    }

    // Vérifier que l'utilisateur a accès à cette société
    const userSociety = await prisma.userSociety.findUnique({
      where: {
        userId_societyId: {
          userId: session.user.id,
          societyId: bankConnection.societyId,
        },
      },
    });

    if (!userSociety) {
      redirect("/banque?error=unauthorized");
    }

    await prisma.bankConnection.update({
      where: { id: state },
      data: {
        status: "active",
        powensConnectionId: powensConnectionId ?? null,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (err) {
    console.error("[callback] Erreur mise a jour connexion:", err);
    redirect("/banque?error=callback_failed");
  }

  redirect("/banque/connexion?ref=" + state);
}
