"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ProprietaireSetupPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bienvenue dans GestImmo</h1>
          <p className="text-muted-foreground">
            Pour commencer, creez votre premiere societe. Elle sera rattachee a votre compte proprietaire.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Votre espace proprietaire</CardTitle>
            <CardDescription>
              En tant que proprietaire, vous pouvez gerer plusieurs societes et consulter un tableau de bord consolide.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">1</div>
              <div>
                <p className="text-sm font-medium">Creez votre premiere societe</p>
                <p className="text-xs text-muted-foreground">SCI, SARL, SAS, ou toute autre forme juridique</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3 opacity-60">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">2</div>
              <div>
                <p className="text-sm font-medium">Ajoutez votre patrimoine</p>
                <p className="text-xs text-muted-foreground">Immeubles, lots, baux et locataires</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3 opacity-60">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">3</div>
              <div>
                <p className="text-sm font-medium">Pilotez depuis votre vue proprietaire</p>
                <p className="text-xs text-muted-foreground">Dashboard consolide sur toutes vos societes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link href="/societes/nouvelle" className="block">
          <Button size="lg" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Creer ma premiere societe
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
