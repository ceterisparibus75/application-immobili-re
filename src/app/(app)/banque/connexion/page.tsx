import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConnexionSync } from "./connexion-sync";

export default async function ConnexionBancairePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref: connectionId } = await searchParams;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");
  if (!connectionId) redirect("/banque");

  return <ConnexionSync societyId={societyId} connectionId={connectionId} />;
}
