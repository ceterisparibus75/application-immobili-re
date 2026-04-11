"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Percent,
} from "lucide-react";
import { addLoanMovement, deleteLoanMovement } from "@/actions/loan";
import { useRouter } from "next/navigation";

interface Movement {
  id: string;
  date: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface MovementsClientProps {
  movements: Movement[];
  loanId: string;
  societyId: string;
  interestRate: number;
  currentBalance: number;
  maxAmount: number | null;
}

const TYPE_INFO: Record<string, { label: string; icon: typeof ArrowUpCircle; color: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPORT: { label: "Apport", icon: ArrowUpCircle, color: "text-[var(--color-status-positive)]", badgeVariant: "default" },
  RETRAIT: { label: "Retrait", icon: ArrowDownCircle, color: "text-destructive", badgeVariant: "destructive" },
  INTERETS: { label: "Intérêts", icon: Percent, color: "text-blue-600 dark:text-blue-400", badgeVariant: "secondary" },
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function MovementsClient({
  movements,
  loanId,
  societyId,
  interestRate,
  currentBalance,
  maxAmount,
}: MovementsClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<string>("APPORT");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await addLoanMovement(societyId, {
      loanId,
      date,
      type,
      amount: parseFloat(amount),
      description: description || null,
    });

    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      setShowForm(false);
      setAmount("");
      setDescription("");
      setType("APPORT");
      router.refresh();
    }
    setIsLoading(false);
  }

  async function handleDelete(movementId: string) {
    setDeletingId(movementId);
    const result = await deleteLoanMovement(societyId, movementId);
    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Bouton d'ajout et jauge */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Solde : <span className="font-semibold text-foreground">{fmt(currentBalance)}</span>
          {maxAmount != null && (
            <span> / {fmt(maxAmount)} ({Math.round((currentBalance / maxAmount) * 100)}%)</span>
          )}
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Nouveau mouvement
        </Button>
      </div>

      {maxAmount != null && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (currentBalance / maxAmount) * 100)}%` }}
          />
        </div>
      )}

      {/* Formulaire d'ajout */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-md border p-4 space-y-4 bg-muted/30">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Type de mouvement</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="APPORT">Apport</option>
                <option value="RETRAIT">Retrait</option>
                <option value="INTERETS">Intérêts ({interestRate}%)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description (optionnel)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Apport complémentaire Q2 2025…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </form>
      )}

      {/* Liste des mouvements */}
      {movements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucun mouvement enregistré
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Montant</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Solde après</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Description</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const info = TYPE_INFO[m.type];
                const Icon = info?.icon ?? ArrowUpCircle;
                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="py-2.5 px-3 tabular-nums">
                      {new Date(m.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3.5 w-3.5 ${info?.color ?? ""}`} />
                        <Badge variant={info?.badgeVariant ?? "outline"} className="text-xs">
                          {info?.label ?? m.type}
                        </Badge>
                      </div>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium tabular-nums ${m.type === "RETRAIT" ? "text-destructive" : info?.color ?? ""}`}>
                      {m.type === "RETRAIT" ? "−" : "+"}{fmt(m.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                      {fmt(m.balanceAfter)}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground max-w-[200px] truncate">
                      {m.description || "—"}
                    </td>
                    <td className="py-2.5 px-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        aria-label="Supprimer le mouvement"
                      >
                        {deletingId === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
