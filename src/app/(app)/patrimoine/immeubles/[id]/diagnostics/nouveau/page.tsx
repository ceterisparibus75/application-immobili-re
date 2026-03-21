"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createDiagnostic } from "@/actions/diagnostic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DIAGNOSTIC_TYPES } from "@/lib/constants";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

export default function NouveauDiagnosticPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
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

    const result = await createDiagnostic(activeSociety.id, {
      buildingId: params.id,
      type: data.type,
      performedAt: data.performedAt,
      expiresAt: data.expiresAt || null,
      result: data.result,
      fileUrl: data.fileUrl || null,
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/patrimoine/immeubles/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/patrimoine/immeubles/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Nouveau diagnostic
          </h1>
          <p className="text-muted-foreground">
            Enregistrer un diagnostic technique
          </p>
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
            <CardTitle>Diagnostic technique</CardTitle>
            <CardDescription>
              DPE, amiante, plomb, électricité, gaz...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type de diagnostic *</Label>
              <Select
                id="type"
                name="type"
                options={[...DIAGNOSTIC_TYPES]}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="performedAt">Date de réalisation *</Label>
                <Input
                  id="performedAt"
                  name="performedAt"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Date d'expiration</Label>
                <Input id="expiresAt" name="expiresAt" type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="result">Résultat / Classement</Label>
              <Input
                id="result"
                name="result"
                placeholder="Ex: Classe D, Conforme, Non-conforme..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileUrl">URL du document</Label>
              <Input
                id="fileUrl"
                name="fileUrl"
                type="url"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                name="notes"
                rows={2}
                placeholder="Observations complémentaires..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/patrimoine/immeubles/${params.id}`}>
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer le diagnostic"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
