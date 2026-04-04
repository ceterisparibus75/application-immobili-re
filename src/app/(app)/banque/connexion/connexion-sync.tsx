"use client";

import { useEffect, useState } from "react";
import { syncOpenBankingAccounts } from "@/actions/bank-connection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export function ConnexionSync({
  societyId,
  connectionId,
}: {
  societyId: string;
  connectionId: string;
}) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [synced, setSynced] = useState(0);

  useEffect(() => {
    syncOpenBankingAccounts(societyId, connectionId).then((result) => {
      if (result.success) {
        setStatus("success");
        setSynced(result.data?.synced ?? 0);
      } else {
        setStatus("error");
        setMessage(result.error ?? "La banque n'a pas encore autorisé l'accès. Revenez dans quelques instants.");
      }
    });
  }, [societyId, connectionId]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {status === "loading" && (
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-2 animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
          )}
          {status === "error" && (
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          )}
          <CardTitle>
            {status === "loading" && "Synchronisation en cours..."}
            {status === "success" && "Connexion réussie !"}
            {status === "error" && "Connexion en attente"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <p className="text-muted-foreground">
              Récupération de vos comptes bancaires...
            </p>
          )}
          {status === "success" && (
            <p className="text-muted-foreground">
              {synced === 0
                ? "Aucun nouveau compte synchronisé."
                : `${synced} compte${synced > 1 ? "s synchronisés" : " synchronisé"} avec succès. Les transactions des 90 derniers jours ont été importées.`}
            </p>
          )}
          {status === "error" && (
            <p className="text-muted-foreground">{message}</p>
          )}

          <div className="flex justify-center gap-3">
            <Link href="/banque">
              <Button disabled={status === "loading"}>Voir mes comptes</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
