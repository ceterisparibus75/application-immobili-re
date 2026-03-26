"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { createCreditNote } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Loader2, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { toast } from "sonner";

export default function AvoirPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const { activeSociety } = useSociety();

  const today = new Date().toISOString().split("T")[0]!;
  const [dueDate, setDueDate] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSociety) return;
    setError("");

    startTransition(async () => {
      const result = await createCreditNote(activeSociety.id, {
        originalInvoiceId: invoiceId,
        dueDate,
        reason: reason || null,
      });

      if (result.success && result.data) {
        toast.success(`Avoir ${result.data.invoiceNumber} émis`);
        router.push(`/facturation/${result.data.id}`);
      } else {
        setError(result.error ?? "Erreur inconnue");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/facturation/${invoiceId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Émettre un avoir</h1>
          <p className="text-muted-foreground">Annule intégralement la facture d&apos;origine</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Action irréversible</p>
          <p>Cet avoir annulera intégralement la facture d&apos;origine. Les montants seront inversés. Un seul avoir peut être émis par facture.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="h-4 w-4" />
              Paramètres de l&apos;avoir
            </CardTitle>
            <CardDescription>
              L&apos;avoir reprendra exactement les lignes de la facture avec des montants inversés.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Date d&apos;échéance *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motif de l&apos;avoir (optionnel)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Erreur de facturation, annulation de commande..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/facturation/${invoiceId}`}>
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
          <Button type="submit" variant="destructive" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Émission en cours...
              </>
            ) : (
              <>
                <ReceiptText className="h-4 w-4" />
                Émettre l&apos;avoir
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
