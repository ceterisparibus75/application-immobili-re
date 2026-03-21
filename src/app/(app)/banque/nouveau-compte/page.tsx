"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBankAccount } from "@/actions/bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

export default function NouveauComptePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createBankAccount(activeSociety.id, {
      bankName: data.bankName!,
      accountName: data.accountName!,
      iban: data.iban!,
      initialBalance: parseFloat(data.initialBalance ?? "0") || 0,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/banque/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Link href="/banque">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau compte bancaire</h1>
          <p className="text-muted-foreground">Ajouter un compte à suivre</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              L&apos;IBAN est chiffré en AES-256-GCM
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankName">Banque *</Label>
                <Input
                  id="bankName"
                  name="bankName"
                  placeholder="BNP Paribas, Crédit Agricole..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountName">Nom du compte *</Label>
                <Input
                  id="accountName"
                  name="accountName"
                  placeholder="Compte courant SCI"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">IBAN *</Label>
              <Input
                id="iban"
                name="iban"
                placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Les espaces sont ignorés automatiquement
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialBalance">Solde initial (€)</Label>
              <Input
                id="initialBalance"
                name="initialBalance"
                type="number"
                step={0.01}
                defaultValue={0}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Solde au moment de l&apos;ouverture du suivi
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/banque">
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer le compte"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
