"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  FileText,
  Receipt,
  TrendingUp,
  Wallet,
  FolderOpen,
  ClipboardList,
  Plus,
  ExternalLink,
} from "lucide-react";
import { ChargeProvisions } from "./charge-provisions";
import { RentRevisions } from "./rent-revisions";
import { RentSteps } from "./rent-steps";
import { LeaseAmendments } from "./lease-amendments";
import { LeasePdfUpload } from "@/components/lease-pdf-upload";
import { LeaseSignaturePanel } from "@/components/lease-signature-panel";
import type { PaymentFrequency, IndexType } from "@/generated/prisma/client";

// ─── Types inline (miroirs des types internes des sous-composants) ─────────────

type RentStepData = {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
  rentHT: number;
  chargesHT: number | null;
  position: number;
};

type Provision = {
  id: string;
  label: string;
  monthlyAmount: number;
  vatRate: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
};

type RevisionData = {
  id: string;
  effectiveDate: Date;
  previousRentHT: number;
  newRentHT: number;
  indexType: IndexType;
  baseIndexValue: number;
  newIndexValue: number;
  formula: string | null;
  isValidated: boolean;
  validatedAt: Date | null;
};

type AmendmentData = {
  id: string;
  amendmentNumber: number;
  effectiveDate: Date;
  description: string;
  amendmentType: string;
  previousRentHT: number | null;
  newRentHT: number | null;
  previousEndDate: Date | null;
  newEndDate: Date | null;
  createdAt: Date;
};

type AmendmentDocument = {
  id: string;
  fileName: string;
  fileUrl: string;
  storagePath: string | null;
  description: string | null;
  createdAt: Date;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  dueDate: Date;
  totalHT: number;
  status: string;
};

type InspectionRow = {
  id: string;
  type: string;
  performedAt: Date;
  performedBy: string | null;
};

type LeaseDocument = {
  id: string;
  fileName: string;
  category: string | null;
  createdAt: Date;
  fileSize: number | null;
  storagePath: string | null;
};

type SerializedSignatureRequest = {
  id: string;
  status: string;
  signerEmail: string;
  signerName: string;
  documentName: string;
  createdAt: string;
  signedAt?: string | null;
  declinedAt?: string | null;
  voidedAt?: string | null;
};

// ─── Props ─────────────────────────────────────────────────────────────────────

type ContractData = {
  leaseTypeLabel: string;
  destinationLabel: string;
  frequencyLabel: string;
  freqPeriodLabel: string;
  startDate: Date;
  endDate: Date | null;
  durationMonths: number;
  rentFreeMonths: number | null;
  entryFee: number | null;
  entryDate: Date | null;
  exitDate: Date | null;
  tenantWorksClauses: string | null;
  leaseNumber: string | null;
  leaseTemplateName: string | null;
  baseRentHT: number;
  currentRentHT: number;
  vatApplicable: boolean;
  vatRate: number;
  depositAmount: number;
  indexType: string | null;
  baseIndexValue: number | null;
  baseIndexQuarter: string | null;
  revisionFrequency: number;
};

type LoyerData = {
  rentSteps: RentStepData[];
  rentStepsCount: number;
  provisions: Provision[];
  revisions: RevisionData[];
  rentRevisionsCount: number;
  leaseStartDate: string;
  leaseEndDate: string | null;
  leaseVatRate: number;
  leaseVatApplicable: boolean;
  paymentFrequency: PaymentFrequency;
};

type FacturationData = {
  invoices: InvoiceRow[];
  invoicesCount: number;
  inspections: InspectionRow[];
  inspectionsCount: number;
};

type DocumentsData = {
  leaseFileUrl: string | null;
  signatureRequests: SerializedSignatureRequest[];
  amendments: AmendmentData[];
  amendmentDocuments: AmendmentDocument[];
  amendmentsCount: number;
  leaseDocuments: LeaseDocument[];
};

export type LeaseDetailTabsProps = {
  leaseId: string;
  societyId: string;
  lotId: string;
  isActive: boolean;
  tenantId: string;
  primaryLotId: string;
  currentRentHT: number;
  contrat: ContractData;
  loyer: LoyerData;
  facturation: FacturationData;
  documents: DocumentsData;
  rentValuationSlot: React.ReactNode;
};

// ─── Constantes d'affichage ────────────────────────────────────────────────────

const INVOICE_STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon", VALIDEE: "Validée", ENVOYEE: "Envoyée",
  EN_ATTENTE: "En attente", PAYE: "Payée", PARTIELLEMENT_PAYE: "Part. payée",
  EN_RETARD: "En retard", RELANCEE: "Relancée", LITIGIEUX: "Litigieux",
  IRRECOUVRABLE: "Irrécouvrable", ANNULEE: "Annulée",
};

const INVOICE_STATUS_VARIANTS: Record<string, "success" | "secondary" | "warning" | "destructive" | "default" | "outline"> = {
  BROUILLON: "outline", VALIDEE: "secondary", ENVOYEE: "default",
  EN_ATTENTE: "default", PAYE: "success", PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive", RELANCEE: "destructive", LITIGIEUX: "destructive",
  IRRECOUVRABLE: "secondary", ANNULEE: "outline",
};

// ─── Sous-composants internes ──────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function LeaseDetailTabs({
  leaseId,
  societyId,
  lotId,
  isActive,
  tenantId,
  primaryLotId,
  currentRentHT,
  contrat,
  loyer,
  facturation,
  documents,
  rentValuationSlot,
}: LeaseDetailTabsProps) {
  return (
    <Tabs defaultValue="contrat" className="w-full">
      <TabsList className="w-full grid grid-cols-4 mb-4">
        <TabsTrigger value="contrat" className="text-xs sm:text-sm">
          <FileText className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
          Contrat
        </TabsTrigger>
        <TabsTrigger value="loyer" className="text-xs sm:text-sm">
          <TrendingUp className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
          Loyer
        </TabsTrigger>
        <TabsTrigger value="facturation" className="text-xs sm:text-sm">
          <Receipt className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
          Facturation
        </TabsTrigger>
        <TabsTrigger value="documents" className="text-xs sm:text-sm">
          <FolderOpen className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
          Documents
        </TabsTrigger>
      </TabsList>

      {/* ── Onglet Contrat ─────────────────────────────────────────────────── */}
      <TabsContent value="contrat" className="space-y-4 mt-0">
        {/* Informations générales */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <DataRow label="Type de bail" value={contrat.leaseTypeLabel} />
              <DataRow label="Destination" value={contrat.destinationLabel} />
              <DataRow label="Fréquence de paiement" value={contrat.frequencyLabel} />
              <DataRow
                label="Date de début"
                value={new Date(contrat.startDate).toLocaleDateString("fr-FR")}
              />
              {contrat.endDate && (
                <DataRow
                  label="Date de fin"
                  value={new Date(contrat.endDate).toLocaleDateString("fr-FR")}
                />
              )}
              <DataRow
                label="Durée"
                value={`${contrat.durationMonths} mois (${Math.floor(contrat.durationMonths / 12)} ans)`}
              />
              {(contrat.rentFreeMonths ?? 0) > 0 && (
                <DataRow label="Franchise de loyer" value={`${contrat.rentFreeMonths} mois`} />
              )}
              {(contrat.entryFee ?? 0) > 0 && (
                <DataRow
                  label="Pas-de-porte"
                  value={`${(contrat.entryFee ?? 0).toLocaleString("fr-FR")} €`}
                />
              )}
              {contrat.entryDate && (
                <DataRow
                  label="Date d'entrée effective"
                  value={new Date(contrat.entryDate).toLocaleDateString("fr-FR")}
                />
              )}
              {contrat.exitDate && (
                <DataRow
                  label="Date de sortie"
                  value={new Date(contrat.exitDate).toLocaleDateString("fr-FR")}
                />
              )}
            </div>

            {contrat.tenantWorksClauses && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Clauses travaux</p>
                  <p className="text-sm whitespace-pre-wrap">{contrat.tenantWorksClauses}</p>
                </div>
              </>
            )}

            {(contrat.leaseNumber || contrat.leaseTemplateName) && (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  {contrat.leaseNumber && (
                    <DataRow
                      label="Numéro de bail"
                      value={<span className="font-mono">{contrat.leaseNumber}</span>}
                    />
                  )}
                  {contrat.leaseTemplateName && (
                    <DataRow label="Modèle utilisé" value={contrat.leaseTemplateName} />
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Conditions financières */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Conditions financières
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Loyer de base HT</p>
                <p className="text-lg font-semibold">
                  {contrat.baseRentHT.toLocaleString("fr-FR")} € / {contrat.freqPeriodLabel}
                </p>
              </div>
              {contrat.currentRentHT !== contrat.baseRentHT && (
                <div>
                  <p className="text-xs text-muted-foreground">Loyer actuel HT</p>
                  <p className="text-lg font-semibold text-primary">
                    {contrat.currentRentHT.toLocaleString("fr-FR")} € / {contrat.freqPeriodLabel}
                  </p>
                </div>
              )}
              <DataRow
                label="TVA"
                value={
                  contrat.vatApplicable
                    ? `Applicable — ${contrat.vatRate} %`
                    : "Non applicable"
                }
              />
              {contrat.vatApplicable && (
                <DataRow
                  label="Loyer actuel TTC"
                  value={`${(contrat.currentRentHT * (1 + contrat.vatRate / 100)).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € / ${contrat.freqPeriodLabel}`}
                />
              )}
              <DataRow
                label="Dépôt de garantie"
                value={`${contrat.depositAmount.toLocaleString("fr-FR")} €`}
              />
            </div>

            {contrat.indexType && (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-3">
                  <DataRow label="Indice de révision" value={contrat.indexType} />
                  {contrat.baseIndexValue !== null && (
                    <DataRow label="Valeur de référence" value={String(contrat.baseIndexValue)} />
                  )}
                  {contrat.baseIndexQuarter && (
                    <DataRow label="Trimestre de référence" value={contrat.baseIndexQuarter} />
                  )}
                  <DataRow
                    label="Fréquence de révision"
                    value={`Tous les ${contrat.revisionFrequency} mois`}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Onglet Loyer ───────────────────────────────────────────────────── */}
      <TabsContent value="loyer" className="space-y-4 mt-0">
        {/* Paliers de loyer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Paliers de loyer{loyer.rentStepsCount > 0 && ` (${loyer.rentStepsCount})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RentSteps
              leaseId={leaseId}
              societyId={societyId}
              steps={loyer.rentSteps}
              isActive={isActive}
              leaseStartDate={loyer.leaseStartDate}
              leaseEndDate={loyer.leaseEndDate}
            />
          </CardContent>
        </Card>

        {/* Provisions sur charges */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Provisions sur charges et taxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChargeProvisions
              leaseId={leaseId}
              lotId={lotId}
              societyId={societyId}
              provisions={loyer.provisions}
              isActive={isActive}
              leaseVatRate={loyer.leaseVatRate}
              leaseVatApplicable={loyer.leaseVatApplicable}
              paymentFrequency={loyer.paymentFrequency}
            />
          </CardContent>
        </Card>

        {/* Révisions de loyer */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Révisions de loyer ({loyer.rentRevisionsCount})
              </CardTitle>
              <Link href="/indices">
                <Button variant="outline" size="sm" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Indices IRL/ILC
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <RentRevisions
              revisions={loyer.revisions}
              societyId={societyId}
              isActive={isActive}
            />
          </CardContent>
        </Card>

        {/* Évaluation des loyers IA */}
        <Card>
          <CardContent className="pt-6">{rentValuationSlot}</CardContent>
        </Card>
      </TabsContent>

      {/* ── Onglet Facturation ─────────────────────────────────────────────── */}
      <TabsContent value="facturation" className="space-y-4 mt-0">
        {/* Factures */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Factures ({facturation.invoicesCount})
              </CardTitle>
              {isActive && (
                <Link href={`/facturation/generer?leaseId=${leaseId}`}>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                    Générer
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {facturation.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune facture émise pour ce bail
              </p>
            ) : (
              <div className="divide-y">
                {facturation.invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/facturation/${inv.id}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        Échéance : {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium">
                        {inv.totalHT.toLocaleString("fr-FR")} € HT
                      </p>
                      <Badge variant={INVOICE_STATUS_VARIANTS[inv.status] ?? "default"}>
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {facturation.invoicesCount > 6 && (
              <Link href={`/facturation?leaseId=${leaseId}`}>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                  Voir toutes les factures
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* États des lieux */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                États des lieux ({facturation.inspectionsCount})
              </CardTitle>
              {isActive && (
                <Link href={`/baux/${leaseId}/inspections/nouveau`}>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                    Nouveau
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {facturation.inspections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun état des lieux enregistré
              </p>
            ) : (
              <div className="divide-y">
                {facturation.inspections.map((insp) => (
                  <div key={insp.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {insp.type === "ENTREE" ? "Entrée" : "Sortie"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(insp.performedAt).toLocaleDateString("fr-FR")}
                        {insp.performedBy ? ` — ${insp.performedBy}` : ""}
                      </p>
                    </div>
                    <Link href={`/baux/${leaseId}/inspections/${insp.id}`}>
                      <Button variant="ghost" size="sm">
                        Voir
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Onglet Documents ───────────────────────────────────────────────── */}
      <TabsContent value="documents" className="space-y-4 mt-0">
        {/* PDF du bail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Document du bail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeasePdfUpload
              leaseId={leaseId}
              currentFileUrl={documents.leaseFileUrl}
            />
          </CardContent>
        </Card>

        {/* Signature électronique */}
        <div>
          <LeaseSignaturePanel
            leaseId={leaseId}
            leaseFileUrl={documents.leaseFileUrl}
            signatureRequests={documents.signatureRequests}
            societyId={societyId}
          />
        </div>

        {/* Avenants */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Avenants ({documents.amendmentsCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeaseAmendments
              amendments={documents.amendments}
              amendmentDocuments={documents.amendmentDocuments}
              leaseId={leaseId}
              societyId={societyId}
              isActive={isActive}
              currentRentHT={currentRentHT}
              tenantId={tenantId}
              primaryLotId={primaryLotId}
            />
          </CardContent>
        </Card>

        {/* Documents associés */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                Documents ({documents.leaseDocuments.length})
              </CardTitle>
              <Link href="/documents">
                <Button variant="outline" size="sm" className="text-xs">
                  Gérer
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {documents.leaseDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun document rattaché à ce bail
              </p>
            ) : (
              <div className="divide-y">
                {documents.leaseDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {doc.category && (
                          <Badge variant="outline" className="text-[10px]">
                            {doc.category}
                          </Badge>
                        )}
                        <span>{new Date(doc.createdAt).toLocaleDateString("fr-FR")}</span>
                        {doc.fileSize && (
                          <span>
                            {doc.fileSize >= 1024 * 1024
                              ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} Mo`
                              : `${Math.round(doc.fileSize / 1024)} Ko`}
                          </span>
                        )}
                      </div>
                    </div>
                    {doc.storagePath && (
                      <Link
                        href={`/api/storage/view?path=${encodeURIComponent(doc.storagePath)}`}
                        target="_blank"
                      >
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// ─── Export du type pour la page ───────────────────────────────────────────────
export type { ContractData, LoyerData, FacturationData, DocumentsData };
