"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateDraftDates } from "@/actions/invoice";

interface Props {
  invoiceId: string;
  societyId: string;
  isDraft: boolean;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
}

function fmtFR(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function DatesEditor({
  invoiceId,
  societyId,
  isDraft,
  issueDate: initIssue,
  dueDate: initDue,
  periodStart: initStart,
  periodEnd: initEnd,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [issueDate, setIssueDate] = useState(initIssue);
  const [dueDate, setDueDate] = useState(initDue);
  const [periodStart, setPeriodStart] = useState(initStart);
  const [periodEnd, setPeriodEnd] = useState(initEnd);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateDraftDates(societyId, invoiceId, {
        issueDate,
        dueDate,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
      });
      if (result.success) {
        toast.success("Dates mises à jour");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la sauvegarde");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setIssueDate(initIssue);
    setDueDate(initDue);
    setPeriodStart(initStart);
    setPeriodEnd(initEnd);
    setIsEditing(false);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {!isEditing ? (
          <div className="relative">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Date d&apos;émission</p>
                <p className="text-sm font-medium">{fmtFR(issueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date d&apos;échéance</p>
                <p className="text-sm font-medium">{fmtFR(dueDate)}</p>
              </div>
              {(periodStart || periodEnd) && (
                <div>
                  <p className="text-xs text-muted-foreground">Période</p>
                  <p className="text-sm font-medium">
                    {fmtFR(periodStart)} → {fmtFR(periodEnd)}
                  </p>
                </div>
              )}
            </div>
            {isDraft && (
              <button
                onClick={() => setIsEditing(true)}
                className="absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Modifier les dates"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Date d&apos;émission *</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date d&apos;échéance *</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Début de période</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fin de période</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !issueDate || !dueDate}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}