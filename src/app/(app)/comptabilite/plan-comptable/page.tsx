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
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

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

  useEffect(() => {
    fetch("/api/comptabilite/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

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
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun compte dans le plan comptable.
            </p>
          </CardContent>
        </Card>
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
    </div>
  );
}
