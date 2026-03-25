import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Callback Powens Open Banking (PSD2).
 * Powens redirige ici apres que l'utilisateur a autorise l'acces a sa banque.
 * URL : ?connection_id=XXX&state=BankConnection.id
 *
 * Note: le token permanent a ete stocke lors de l'initiation (initPowensUser).
 * Le callback se contente de marquer la connexion comme active.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const powensConnectionId = searchParams.get("connection_id");

  if (!state) {
    redirect("/banque?error=missing_state");
  }

  try {
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
