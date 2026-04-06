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
        <h3 className="text-lg font-semibold">Rapports d&apos;experts</h3>
        <Button variant="outline" onClick={() => setShowForm(!showForm)}>
          <Upload className="h-4 w-4 mr-2" />
          Importer un rapport
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importer un rapport d&apos;expertise PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="expertName">Nom de l&apos;expert *</Label>
                  <Input id="expertName" name="expertName" required placeholder="Cabinet Dupont" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportDate">Date du rapport *</Label>
                  <Input id="reportDate" name="reportDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportReference">Référence</Label>
                  <Input id="reportReference" name="reportReference" placeholder="REF-2024-001" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Fichier PDF *</Label>
                <Input id="file" name="file" type="file" accept=".pdf" required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isPending}>
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
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">Aucun rapport d&apos;expert importé.</p>
          </CardContent>
        </Card>
      )}

      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{report.expertName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(report.reportDate)}
                  {report.reportReference && ` — Réf. ${report.reportReference}`}
                </p>
                <p className="text-sm text-muted-foreground">{report.fileName}</p>
              </div>
              <div className="text-right">
                {report.estimatedValue && (
                  <p className="font-semibold">{formatCurrency(report.estimatedValue)}</p>
                )}
                {report.methodology && (
                  <p className="text-xs text-muted-foreground">{report.methodology}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
