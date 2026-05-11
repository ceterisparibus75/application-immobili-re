"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, RefreshCw, Pencil, AlertTriangle } from "lucide-react";
import { deleteLoan, regenerateAmortizationTable, updateLoan } from "@/actions/loan";
import { toast } from "sonner";

export type LoanEditData = {
  id: string;
  label: string;
  lender: string;
  amount: number;
  interestRate: number;
  insuranceRate: number;
  durationMonths: number;
  startDate: string;
  purchaseValue: number | null;
  notes: string | null;
  loanType: string;
  partnerName: string | null;
  partnerShare: number | null;
  maxAmount: number | null;
  conventionDate: string | null;
  nominalValue: number | null;
  bondCount: number | null;
  couponFrequency: string | null;
  issuePrice: number | null;
};

function calcMonthlyPayment(amount: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return amount / months;
  return (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function EditLoanDialog({
  loan,
  societyId,
  onClose,
}: {
  loan: LoanEditData;
  societyId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [label, setLabel] = useState(loan.label);
  const [lender, setLender] = useState(loan.lender);
  const [amount, setAmount] = useState(String(loan.amount));
  const [interestRate, setInterestRate] = useState(String(loan.interestRate));
  const [insuranceRate, setInsuranceRate] = useState(String(loan.insuranceRate));
  const [durationMonths, setDurationMonths] = useState(String(loan.durationMonths));
  const [startDate, setStartDate] = useState(loan.startDate.split("T")[0]);
  const [purchaseValue, setPurchaseValue] = useState(
    loan.purchaseValue != null ? String(loan.purchaseValue) : ""
  );
  const [notes, setNotes] = useState(loan.notes ?? "");

  const amountN = parseFloat(amount) || 0;
  const rateN = parseFloat(interestRate) || 0;
  const insN = parseFloat(insuranceRate) || 0;
  const monthsN = parseInt(durationMonths) || 0;

  const newMonthly =
    amountN > 0 && rateN >= 0 && monthsN > 0 ? calcMonthlyPayment(amountN, rateN, monthsN) : 0;
  const newMonthlyIns = amountN > 0 ? (amountN * insN) / 100 / 12 : 0;
  const currentMonthly = calcMonthlyPayment(loan.amount, loan.interestRate, loan.durationMonths);
  const currentMonthlyIns = (loan.amount * loan.insuranceRate) / 100 / 12;

  const willRegen =
    loan.loanType !== "COMPTE_COURANT" &&
    (Math.abs(amountN - loan.amount) > 0.01 ||
      Math.abs(rateN - loan.interestRate) > 0.0001 ||
      Math.abs(insN - loan.insuranceRate) > 0.0001 ||
      monthsN !== loan.durationMonths ||
      startDate !== loan.startDate.split("T")[0]);

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateLoan(societyId, loan.id, {
        label: label.trim(),
        lender: lender.trim(),
        amount: amountN,
        interestRate: rateN,
        insuranceRate: insN,
        durationMonths: monthsN,
        startDate,
        purchaseValue: purchaseValue ? parseFloat(purchaseValue) : null,
        notes: notes.trim() || null,
        partnerName: loan.partnerName,
        partnerShare: loan.partnerShare,
        maxAmount: loan.maxAmount,
        conventionDate: loan.conventionDate,
        nominalValue: loan.nominalValue,
        bondCount: loan.bondCount,
        couponFrequency: loan.couponFrequency,
        issuePrice: loan.issuePrice,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        if (result.data?.regenerated) {
          toast.success(
            "Emprunt mis Ã  jour â€” tableau rÃ©gÃ©nÃ©rÃ© (" + result.data.linesCount + " Ã©chÃ©ances)"
          );
        } else {
          toast.success("Emprunt mis Ã  jour");
        }
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="edit-label">LibellÃ©</Label>
          <Input id="edit-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-lender">Ã‰tablissement prÃªteur</Label>
          <Input id="edit-lender" value={lender} onChange={(e) => setLender(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-amount">Capital empruntÃ© (â‚¬)</Label>
          <Input
            id="edit-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-interest">Taux nominal annuel (%)</Label>
          <Input
            id="edit-interest"
            type="number"
            step="0.001"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-insurance">Taux assurance annuel (%)</Label>
          <Input
            id="edit-insurance"
            type="number"
            step="0.001"
            value={insuranceRate}
            onChange={(e) => setInsuranceRate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-duration">DurÃ©e (mois)</Label>
          <Input
            id="edit-duration"
            type="number"
            step="1"
            min="1"
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-start">Date de dÃ©but</Label>
          <Input
            id="edit-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-purchase">{"Valeur d'acquisition (â‚¬)"}</Label>
          <Input
            id="edit-purchase"
            type="number"
            step="0.01"
            value={purchaseValue}
            onChange={(e) => setPurchaseValue(e.target.value)}
            placeholder="Optionnel"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-notes">Notes</Label>
        <Textarea
          id="edit-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optionnel"
        />
      </div>

      {newMonthly > 0 && (
        <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
          <p className="font-medium">{"AperÃ§u de l'Ã©chÃ©ance mensuelle"}</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"Actuelle :"}</span>
            <span>{fmt(currentMonthly + currentMonthlyIns)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"Nouvelle :"}</span>
            <span className="font-semibold">{fmt(newMonthly + newMonthlyIns)}</span>
          </div>
        </div>
      )}

      {willRegen && (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {"Le tableau d'amortissement sera rÃ©gÃ©nÃ©rÃ© avec les nouveaux paramÃ¨tres. Les Ã©chÃ©ances dÃ©jÃ  pointÃ©es seront conservÃ©es."}
          </span>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isPending || !label.trim() || !lender.trim() || amountN <= 0 || monthsN <= 0}
        >
          {isPending ? "Enregistrementâ€¦" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function LoanActionsClient({
  loanId,
  societyId,
  loanLabel,
  loan,
}: {
  loanId: string;
  societyId: string;
  loanLabel: string;
  loan: LoanEditData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"delete" | "regen" | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  function handleDelete() {
    setAction("delete");
    startTransition(async () => {
      const result = await deleteLoan(societyId, loanId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Emprunt supprimÃ©");
        router.push("/emprunts");
      }
      setAction(null);
    });
  }

  function handleRegenerate() {
    setAction("regen");
    startTransition(async () => {
      const result = await regenerateAmortizationTable(societyId, loanId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Tableau rÃ©gÃ©nÃ©rÃ© (" + (result.data?.linesCount ?? 0) + " Ã©chÃ©ances)");
        router.refresh();
      }
      setAction(null);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditOpen(true)}
          disabled={isPending}
        >
          <Pencil className="h-4 w-4" />
          Modifier
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={isPending}
        >
          <RefreshCw
            className={"h-4 w-4 " + (action === "regen" && isPending ? "animate-spin" : "")}
          />
          RÃ©gÃ©nÃ©rer le tableau
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isPending}>
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cet emprunt ?</AlertDialogTitle>
              <AlertDialogDescription>
                {"L'emprunt Â«"} {loanLabel}
                {" Â» et tout son tableau d'amortissement seront dÃ©finitivement supprimÃ©s. Cette action est irrÃ©versible."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {action === "delete" && isPending ? "Suppressionâ€¦" : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{"Modifier l'emprunt"}</DialogTitle>
          </DialogHeader>
          <EditLoanDialog
            loan={loan}
            societyId={societyId}
            onClose={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
