import { syncOpenBankingAccounts } from "@/actions/bank-connection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

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

  const result = await syncOpenBankingAccounts(societyId, connectionId);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {result.success ? (
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
          ) : (
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          )}
          <CardTitle>
            {result.success ? "Connexion réussie !" : "Connexion en attente"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {result.success ? (
            <p className="text-muted-foreground">
              {result.data?.synced === 0
                ? "Aucun nouveau compte synchronisé."
                : `${result.data?.synced} compte${(result.data?.synced ?? 0) > 1 ? "s synchronisés" : " synchronisé"} avec succès. Les transactions des 90 derniers jours ont été importées.`}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {result.error ?? "La banque n'a pas encore autorisé l'accès. Revenez dans quelques instants."}
            </p>
          )}

          <div className="flex justify-center gap-3">
            <Link href="/banque">
              <Button>Voir mes comptes</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
