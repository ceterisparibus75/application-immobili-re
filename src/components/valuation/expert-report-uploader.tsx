"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { uploadExpertReport } from "@/actions/valuation";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ExpertReport {
  id: string;
  expertName: string;
  reportDate: Date;
  reportReference: string | null;
  fileName: string;
  estimatedValue: number | null;
  methodology: string | null;
  createdAt: Date;
}

export function ExpertReportUploader({
  reports,
  valuationId,
  societyId,
}: {
  reports: ExpertReport[];
  valuationId: string;
  societyId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    formData.set("societyId", societyId);
    startTransition(async () => {
      const result = await uploadExpertReport(societyId, valuationId, formData);
      if (result.success) {
        toast.success("Rapport importé et analysé");
        setShowForm(false);
        formRef.current?.reset();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-brand-deep)]">Rapports d&apos;experts</h3>
        <Button variant="outline" onClick={() => setShowForm(!showForm)}>
          <Upload className="h-4 w-4 mr-2" />
          Importer un rapport
        </Button>
      </div>

      {showForm && (
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)]">
                <FileText className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
              </div>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Importer un rapport d&apos;expertise PDF</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Nom de l&apos;expert *</Label>
                  <Input name="expertName" required placeholder="Cabinet Dupont" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Date du rapport *</Label>
                  <Input name="reportDate" type="date" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Référence</Label>
                  <Input name="reportReference" placeholder="REF-2024-001" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Fichier PDF *</Label>
                <Input name="file" type="file" accept=".pdf" required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isPending} className="bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-deep)] text-white">
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Import et analyse...
                    </>
                  ) : (
                    "Importer"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {reports.length === 0 && !showForm && (
        <div className="bg-white rounded-xl shadow-brand py-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-[#94A3B8]/50" />
          <p className="mt-3 text-sm text-[#94A3B8]">Aucun rapport d&apos;expert importé.</p>
        </div>
      )}

      {reports.map((report) => (
        <Card key={report.id} className="border-0 shadow-brand bg-white rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-[var(--color-brand-deep)]">{report.expertName}</p>
                <p className="text-xs text-[#94A3B8]">
                  {formatDate(report.reportDate)}
                  {report.reportReference && ` — Réf. ${report.reportReference}`}
                </p>
                <p className="text-xs text-[#94A3B8]">{report.fileName}</p>
              </div>
              <div className="text-right">
                {report.estimatedValue && (
                  <p className="text-lg font-semibold tabular-nums text-[var(--color-brand-deep)]">{formatCurrency(report.estimatedValue)}</p>
                )}
                {report.methodology && (
                  <p className="text-[10px] text-[#94A3B8]">{report.methodology}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
