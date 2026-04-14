"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Upload,
  Zap,
} from "lucide-react";

export default function NouveauBailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Rétro-compatibilité : rediriger les anciens liens ?mode=workflow / ?mode=existing
  useEffect(() => {
    const mode = searchParams.get("mode");
    const lotId = searchParams.get("lotId");
    const tenantId = searchParams.get("tenantId");

    if (mode === "workflow" || mode === "existing") {
      const params = new URLSearchParams();
      if (lotId) params.set("lotId", lotId);
      if (tenantId) params.set("tenantId", tenantId);
      const qs = params.toString();
      router.replace(`/baux/nouveau/rapide${qs ? `?${qs}` : ""}`);
      return;
    }

    // Si lotId ou tenantId sans mode → aller directement au bail rapide
    if (lotId || tenantId) {
      const params = new URLSearchParams();
      if (lotId) params.set("lotId", lotId);
      if (tenantId) params.set("tenantId", tenantId);
      router.replace(`/baux/nouveau/rapide?${params.toString()}`);
    }
  }, [searchParams, router]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/baux">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau bail</h1>
          <p className="text-muted-foreground">
            Choisissez le parcours adapté à votre situation
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Parcours 1 — Bail rapide */}
        <Link href="/baux/nouveau/rapide" className="group">
          <Card className="h-full transition-all hover:border-primary hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Zap className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Bail rapide</CardTitle>
              </div>
              <CardDescription>
                Lot et locataire déjà dans l&apos;application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sélectionnez un lot et un locataire existants, renseignez les
                conditions financières et créez le bail en quelques clics.
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  Sélection lot + locataire
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  Conditions financières
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  Création immédiate
                </li>
              </ul>
              <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Commencer
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Parcours 2 — Import PDF */}
        <Link href="/baux/import" className="group">
          <Card className="h-full transition-all hover:border-primary hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Import depuis un PDF</CardTitle>
              </div>
              <CardDescription>
                L&apos;IA analyse le bail signé et prérempli tout
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Déposez le PDF de votre bail signé. L&apos;intelligence artificielle
                extrait les données et crée automatiquement les entités manquantes.
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-blue-500" />
                  Upload du PDF signé
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-blue-500" />
                  Extraction IA automatique
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-blue-500" />
                  Vérification et validation
                </li>
              </ul>
              <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Commencer
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Parcours 3 — Bail complet */}
        <Link href="/baux/nouveau/complet" className="group">
          <Card className="h-full transition-all hover:border-primary hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                  <FileText className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Bail complet</CardTitle>
              </div>
              <CardDescription>
                Créer tout depuis zéro (immeuble, lot, locataire)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Assistant étape par étape pour créer l&apos;immeuble, le lot, le
                locataire et le bail en une seule opération.
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-violet-500" />
                  Immeuble (existant ou nouveau)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-violet-500" />
                  Lot (existant ou nouveau)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-violet-500" />
                  Locataire + conditions du bail
                </li>
              </ul>
              <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Commencer
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
