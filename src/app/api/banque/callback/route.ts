import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/**
 * Callback OAuth GoCardless Bank Account Data.
 * GoCardless redirige ici après que l'utilisateur a autorisé l'accès à sa banque.
 * L'URL contient le paramètre `ref` = connectionId stocké lors de la réquisition.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");

  if (!ref) {
    redirect("/banque");
  }

  // Rediriger vers la page de connexion qui effectuera la sync
  redirect(`/banque/connexion?ref=${ref}`);
}
