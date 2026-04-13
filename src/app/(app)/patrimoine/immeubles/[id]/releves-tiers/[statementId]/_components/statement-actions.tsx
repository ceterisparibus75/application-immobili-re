"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  validateStatement,
  recordStatementPayment,
} from "@/actions/third-party-statement";
import { useSociety } from "@/providers/society-provider";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
} from "lucide-react";
import type { StatementStatus, StatementType } from "@/generated/prisma/client";

interface StatementActionsProps {
  statementId: string;
  buildingId: string;
  type: StatementType;
  status: StatementStatus;
  totalAmount: number;
  paidAmount: number;
}

export function StatementActions({
  statementId,
  buildingId,
  type,
  status,
  totalAmount,
  paidAmount,
}: StatementActionsProps) {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isValidating, setIsValidating] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Champs du formulaire de paiement
  const [paymentAmount, setPaymentAmount] = useState(
    String(totalAmount - paidAmount)
  );
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  async function handleValidate() {
    if (!activeSociety) return;
    setIsValidating(true);
    const result = await validateStatement(activeSociety.id, statementId);
    setIsValidating(false);

    if (result.success) {
      toast.success("Releve valide avec succes");
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de la validation");
    }
  }

  async function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Le montant doit etre positif");
      return;
    }

    setIsSubmittingPayment(true);
    const result = await recordStatementPayment(activeSociety.id, {
      statementId,
      amount,
      paidAt: paymentDate,
      method: paymentMethod || undefined,
      reference: paymentReference || undefined,
    });
    setIsSubmittingPayment(false);

    if (result.success) {
      toast.success("Paiement enregistre avec succes");
      setIsPaymentOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de l'enregistrement du paiement");
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Bouton Valider (brouillon uniquement) */}
      {status === "BROUILLON" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleValidate}
          disabled={isValidating}
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Valider
        </Button>
      )}

      {/* Bouton Paiement (appel de fonds valide ou partiellement paye) */}
      {type === "APPEL_FONDS" &&
        (status === "VALIDE" || status === "PARTIELLEMENT_PAYE") && (
          <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
                <CreditCard className="h-4 w-4" />
                Enregistrer un paiement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enregistrer un paiement</DialogTitle>
                <DialogDescription>
                  Saisissez les informations du paiement effectue au syndic.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handlePayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Montant *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    Reste du : {((totalAmount - paidAmount).toFixed(2))} EUR
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Date du paiement *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Moyen de paiement</Label>
                  <Input
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Ex: Virement, Cheque, Prelevement"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentReference">Reference</Label>
                  <Input
                    id="paymentReference"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Ex: VIR-2026-0412"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPaymentOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmittingPayment}>
                    {isSubmittingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

      {/* Bouton Regularisation (decompte valide) */}
      {type === "DECOMPTE_CHARGES" && status === "VALIDE" && (
        <Button variant="outline" size="sm" disabled>
          Calculer la regularisation
        </Button>
      )}
    </div>
  );
}
