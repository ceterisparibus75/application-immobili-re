import { getValuation } from "@/actions/valuation";
import { ValuationDashboard } from "@/components/valuation/valuation-dashboard";
import { AiAnalysisPanel } from "@/components/valuation/ai-analysis-panel";
import { ExpertReportUploader } from "@/components/valuation/expert-report-uploader";
import { ComparablesTable } from "@/components/valuation/comparables-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, Download, FileText } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
};

const STATUS_VARIANTS: Record<string, "secondary" | "warning" | "success" | "destructive"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  ARCHIVED: "destructive",
};

export default async function ValuationDetailPage({
  params,
}: {
  params: Promise<{ id: string; valuationId: string }>;
}) {
  const { id, valuationId } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const valuation = await getValuation(societyId, valuationId);
  if (!valuation) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/patrimoine/immeubles" className="hover:text-foreground transition-colors">
          Immeubles
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/patrimoine/immeubles/${id}`} className="hover:text-foreground transition-colors">
          {valuation.building.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/patrimoine/immeubles/${id}/valorisation`} className="hover:text-foreground transition-colors">
          Valorisation
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">
          Avis du {formatDate(valuation.valuationDate)}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Avis de valeur — {valuation.building.name}
            </h1>
            <Badge variant={STATUS_VARIANTS[valuation.status] ?? "secondary"}>
              {STATUS_LABELS[valuation.status] ?? valuation.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5">
            {valuation.building.addressLine1}, {valuation.building.postalCode} {valuation.building.city}
          </p>
        </div>
        <Link href={`/api/valuations/${valuationId}/pdf`} target="_blank">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Télécharger le rapport PDF
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <ValuationDashboard
        estimatedValueMid={valuation.estimatedValueMid}
        estimatedValueLow={valuation.estimatedValueLow}
        estimatedValueHigh={valuation.estimatedValueHigh}
        estimatedRentalValue={valuation.estimatedRentalValue}
        pricePerSqm={valuation.pricePerSqm}
        capitalizationRate={valuation.capitalizationRate}
      />

      {/* Tabs */}
      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">
            Analyses IA ({valuation.aiAnalyses.length})
          </TabsTrigger>
          <TabsTrigger value="experts">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Experts ({valuation.expertReports.length})
          </TabsTrigger>
          <TabsTrigger value="comparables">
            Comparables ({valuation.comparableSales.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <AiAnalysisPanel
            analyses={valuation.aiAnalyses}
            valuationId={valuationId}
            societyId={societyId}
          />
        </TabsContent>

        <TabsContent value="experts" className="mt-4">
          <ExpertReportUploader
            reports={valuation.expertReports}
            valuationId={valuationId}
            societyId={societyId}
          />
        </TabsContent>

        <TabsContent value="comparables" className="mt-4">
          <ComparablesTable
            comparables={valuation.comparableSales}
            valuationId={valuationId}
            societyId={societyId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
