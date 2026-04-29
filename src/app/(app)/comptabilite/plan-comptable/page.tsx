"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Check, Loader2, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useSociety } from "@/providers/society-provider";
import { initDefaultChartOfAccounts } from "@/actions/accounting";

type Account = {
  id: string;
  code: string;
  label: string;
  type: string;
};

const CLASS_LABELS: Record<string, string> = {
  "1": "Classe 1 — Comptes de capitaux",
  "2": "Classe 2 — Comptes d'immobilisations",
  "3": "Classe 3 — Comptes de stocks",
  "4": "Classe 4 — Comptes de tiers",
  "5": "Classe 5 — Comptes financiers",
  "6": "Classe 6 — Comptes de charges",
  "7": "Classe 7 — Comptes de produits",
};

export default function PlanComptablePage() {
  const { activeSociety } = useSociety();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    fetch("/api/comptabilite/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  async function handleInitDefault() {
    if (!activeSociety) return;
    setIsInitializing(true);
    const result = await initDefaultChartOfAccounts(activeSociety.id);
    if (result.success && result.data) {
      toast.success(`${result.data.created} comptes créés avec succès`);
      const refreshed = await fetch("/api/comptabilite/accounts").then((r) => r.json());
      setAccounts(Array.isArray(refreshed) ? refreshed : []);
      setShowInitDialog(false);
    } else {
      toast.error(result.error ?? "Erreur lors de l'initialisation");
    }
    setIsInitializing(false);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;
    setIsSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const code = formData.get("code") as string;
    const label = formData.get("label") as string;

    const res = await fetch("/api/comptabilite/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, label, type: code[0] }),
    });

    if (res.ok) {
      const newAcc = await res.json();
      setAccounts((prev) => [...prev, newAcc].sort((a, b) => a.code.localeCompare(b.code)));
      setShowForm(false);
      (e.target as HTMLFormElement).reset();
    } else {
      const err = await res.json();
      setError(err.error ?? "Erreur lors de la création");
    }
    setIsSaving(false);
  }

  const filtered = accounts.filter(
    (a) =>
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.label.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, Account[]>>((acc, a) => {
    const cls = a.code[0] ?? "?";
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/comptabilite">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Plan comptable</h1>
          <p className="text-muted-foreground">{accounts.length} compte(s)</p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/comptabilite/plan-comptable/importer">
            <Upload className="h-4 w-4" />
            Importer
          </Link>
        </Button>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Nouveau compte
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau compte</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleCreate} className="flex gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="code" className="text-xs">Code *</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="706100"
                  className="w-32"
                  required
                  pattern="[0-9]+"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="label" className="text-xs">Intitulé *</Label>
                <Input
                  id="label"
                  name="label"
                  placeholder="Loyers commerciaux"
                  required
                />
              </div>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Input
          placeholder="Rechercher un compte..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          Chargement...
        </div>
      ) : accounts.length === 0 ? (
        <div className="space-y-4">
          <Card className="border-0 shadow-brand rounded-xl">
            <CardContent className="py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mx-auto mb-4">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1">Aucun compte dans le plan comptable</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Commencez par initialiser un plan comptable pré-rempli adapté aux sociétés immobilières françaises (PCG), ou importez votre propre plan.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button onClick={() => setShowInitDialog(true)} className="gap-2 bg-brand-gradient-soft hover:opacity-90 text-white">
                  <Check className="h-4 w-4" />
                  Initialiser le plan comptable immobilier
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/comptabilite/plan-comptable/importer" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Importer mon plan existant
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Le plan par défaut comprend 67 comptes :</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Classe 1 — Capitaux (capital, réserves, emprunts…)",
                "Classe 2 — Immobilisations (terrains, bâtiments, amortissements…)",
                "Classe 4 — Tiers (locataires, fournisseurs, TVA…)",
                "Classe 5 — Financiers (banque, caisse)",
                "Classe 6 — Charges (entretien, assurance, taxe foncière, intérêts…)",
                "Classe 7 — Produits (loyers hab., commerciaux, parkings, APL…)",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(grouped)
            .sort()
            .map((cls) => (
              <Card key={cls}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {CLASS_LABELS[cls] ?? `Classe ${cls}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {grouped[cls].map((a) => (
                        <tr key={a.id}>
                          <td className="py-1.5 pr-4 font-mono text-xs w-20">
                            {a.code}
                          </td>
                          <td className="py-1.5">{a.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initialiser le plan comptable immobilier</DialogTitle>
            <DialogDescription>
              67 comptes du Plan Comptable Général adaptés aux sociétés immobilières françaises vont être créés (classes 1, 2, 4, 5, 6 et 7).
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            Cette action ne s&apos;applique qu&apos;aux plans vides. Si vous avez déjà un plan comptable propre, utilisez plutôt la fonction <strong>Importer</strong>.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)} disabled={isInitializing}>
              Annuler
            </Button>
            <Button onClick={handleInitDefault} disabled={isInitializing} className="gap-2 bg-brand-gradient-soft hover:opacity-90 text-white">
              {isInitializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isInitializing ? "Initialisation…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
