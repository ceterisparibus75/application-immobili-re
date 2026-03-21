"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const TYPE_OPTIONS = [
  { value: "access", label: "Accès aux données" },
  { value: "rectification", label: "Rectification" },
  { value: "deletion", label: "Suppression (droit à l'oubli)" },
  { value: "portability", label: "Portabilité" },
  { value: "opposition", label: "Opposition au traitement" },
];

export default function NouvelleDemandeRgpdPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      requesterName: formData.get("requesterName"),
      requesterEmail: formData.get("requesterEmail"),
      requestType: formData.get("requestType"),
      notes: formData.get("notes") || null,
    };

    const res = await fetch("/api/rgpd/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/rgpd");
    } else {
      const data = await res.json();
      setError(data.error ?? "Erreur lors de la création");
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Link href="/rgpd">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Enregistrer une demande RGPD
          </h1>
          <p className="text-muted-foreground">
            Exercice de droits d&apos;une personne concernée
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
            <CardTitle>Identité du demandeur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requesterName">Nom complet *</Label>
              <Input
                id="requesterName"
                name="requesterName"
                placeholder="Jean Dupont"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requesterEmail">Email *</Label>
              <Input
                id="requesterEmail"
                name="requesterEmail"
                type="email"
                placeholder="jean@exemple.fr"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nature de la demande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestType">Type *</Label>
              <Select
                id="requestType"
                name="requestType"
                options={TYPE_OPTIONS}
                defaultValue="access"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Contexte</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Détails de la demande..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/rgpd">
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
              "Enregistrer la demande"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
