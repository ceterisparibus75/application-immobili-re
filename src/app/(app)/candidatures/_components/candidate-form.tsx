"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { createCandidate } from "@/actions/candidate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type LotOption = {
  value: string;
  label: string;
};

type CandidateFormProps = {
  societyId: string;
  lots: LotOption[];
};

const SOURCE_OPTIONS = [
  { value: "direct", label: "Contact direct" },
  { value: "site", label: "Site web" },
  { value: "leboncoin", label: "Leboncoin" },
  { value: "seloger", label: "SeLoger" },
  { value: "recommandation", label: "Recommandation" },
  { value: "agence", label: "Agence / partenaire" },
  { value: "autre", label: "Autre" },
];

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalNumber(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function CandidateForm({ societyId, lots }: CandidateFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError("");

    const firstName = readString(formData, "firstName");
    const lastName = readString(formData, "lastName");
    const email = readString(formData, "email");
    const phone = readString(formData, "phone");
    const company = readString(formData, "company");
    const lotId = readString(formData, "lotId");
    const source = readString(formData, "source");
    const desiredMoveIn = readString(formData, "desiredMoveIn");
    const notes = readString(formData, "notes");
    const guarantorName = readString(formData, "guarantorName");
    const tags = readString(formData, "tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createCandidate(societyId, {
        firstName,
        lastName,
        email,
        phone,
        company,
        lotId: lotId || undefined,
        source: source || undefined,
        monthlyIncome: readOptionalNumber(formData, "monthlyIncome"),
        score: readOptionalNumber(formData, "score"),
        guarantorName,
        desiredMoveIn: desiredMoveIn || undefined,
        notes,
        tags,
      });

      if (!result.success) {
        setError(result.error ?? "Impossible de créer la candidature");
        return;
      }

      router.push("/candidatures");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle candidature</h1>
          <p className="text-sm text-muted-foreground">
            Qualifiez le dossier avant de créer le locataire et le bail.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" />
              Identité et contact
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom *" htmlFor="firstName">
              <Input id="firstName" name="firstName" required autoComplete="given-name" />
            </Field>
            <Field label="Nom *" htmlFor="lastName">
              <Input id="lastName" name="lastName" required autoComplete="family-name" />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" />
            </Field>
            <Field label="Téléphone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" autoComplete="tel" />
            </Field>
            <Field label="Société / employeur" htmlFor="company">
              <Input id="company" name="company" />
            </Field>
            <Field label="Source" htmlFor="source">
              <NativeSelect id="source" name="source" options={SOURCE_OPTIONS} defaultValue="direct" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qualification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Lot visé" htmlFor="lotId">
              <NativeSelect
                id="lotId"
                name="lotId"
                options={lots}
                placeholder={lots.length > 0 ? "Associer un lot vacant" : "Aucun lot vacant"}
                disabled={lots.length === 0}
                defaultValue=""
              />
            </Field>
            <Field label="Revenus mensuels" htmlFor="monthlyIncome">
              <Input id="monthlyIncome" name="monthlyIncome" type="number" min="0" step="1" inputMode="numeric" />
            </Field>
            <Field label="Score dossier" htmlFor="score">
              <Input id="score" name="score" type="number" min="0" max="100" step="1" inputMode="numeric" />
            </Field>
            <Field label="Garant" htmlFor="guarantorName">
              <Input id="guarantorName" name="guarantorName" />
            </Field>
            <Field label="Emménagement souhaité" htmlFor="desiredMoveIn">
              <Input id="desiredMoveIn" name="desiredMoveIn" type="date" />
            </Field>
            <Field label="Tags" htmlFor="tags">
              <Input id="tags" name="tags" placeholder="solvable, urgent, dossier complet" />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes de suivi</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            rows={5}
            placeholder="Synthèse de l'échange, pièces reçues, points à vérifier, prochaine action..."
          />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/candidatures")}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isPending ? "Création..." : "Créer la candidature"}
        </Button>
      </div>
    </form>
  );
}
