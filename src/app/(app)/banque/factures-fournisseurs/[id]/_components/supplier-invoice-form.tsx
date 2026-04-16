"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import {
  CheckCircle2,
  XCircle,
  CreditCard,
  Download,
  Loader2,
  Pencil,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  updateSupplierInvoiceData,
  validateSupplierInvoice,
  rejectSupplierInvoice,
  markSupplierInvoicePaid,
  initiateQontoPayment,
} from "@/actions/supplier-invoice";
import { toast } from "sonner";

interface Building {
  id: string;
  name: string;
}

interface Tenant {
  id: string;
  label: string;
}

interface AccountingAccount {
  id: string;
  code: string;
  label: string;
}

interface Category {
  id: string;
  name: string;
  nature: string;
  buildingId: string | null;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  qontoAccountId: string | null;
}

interface InvoiceData {
  id: string;
  status: string;
  reference: string | null;
  source: string | null;
  senderEmail: string | null;
  emailSubject: string | null;
  receivedAt: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  supplierName: string | null;
  supplierSiret: string | null;
  supplierAddress: string | null;
  supplierBic: string | null;
  hasIban: boolean;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  amountHT: number | null;
  amountVAT: number | null;
  amountTTC: number | null;
  vatRate: number | null;
  currency: string | null;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  aiConfidence: number | null;
  aiStatus: string | null;
  buildingId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  categoryId: string | null;
  accountingAccountId: string | null;
  chargeId: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentScheduledAt: string | null;
  paymentExecutedAt: string | null;
  paymentReference: string | null;
  bankAccountId: string | null;
  qontoTransferId: string | null;
  sepaXmlUrl: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  validatedAt: string | null;
  createdAt: string;
}

interface Props {
  invoice: InvoiceData;
  societyId: string;
  buildings: Building[];
  categories: Category[];
  bankAccounts: BankAccount[];
  tenants: Tenant[];
  accountingAccounts: AccountingAccount[];
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.substring(0, 10);
}

export function SupplierInvoiceForm({ invoice, societyId, buildings, categories, bankAccounts, tenants, accountingAccounts }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [validating, startValidate] = useTransition();
  const [rejecting, startReject] = useTransition();
  const [paying, startPay] = useTransition();
  const [qontoPaying, startQontoPay] = useTransition();

  const isReadonly = invoice.status === "PAID" || invoice.status === "ARCHIVED";
  const isAI = (invoice.aiConfidence ?? 0) > 0.3;

  // Form state
  const [supplierName, setSupplierName] = useState(invoice.supplierName ?? "");
  const [supplierBic, setSupplierBic] = useState(invoice.supplierBic ?? "");
  const [editIban, setEditIban] = useState(!invoice.hasIban);
  const [supplierIban, setSupplierIban] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(toDateInput(invoice.invoiceDate));
  const [dueDate, setDueDate] = useState(toDateInput(invoice.dueDate));
  const [amountHT, setAmountHT] = useState(invoice.amountHT?.toString() ?? "");
  const [amountVAT, setAmountVAT] = useState(invoice.amountVAT?.toString() ?? "");
  const [amountTTC, setAmountTTC] = useState(invoice.amountTTC?.toString() ?? "");
  const [vatRate, setVatRate] = useState(invoice.vatRate?.toString() ?? "");
  const [description, setDescription] = useState(invoice.description ?? "");
  const [periodStart, setPeriodStart] = useState(toDateInput(invoice.periodStart));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(invoice.periodEnd));
  const [buildingId, setBuildingId] = useState(invoice.buildingId ?? "");
  const [categoryId, setCategoryId] = useState(invoice.categoryId ?? "");
  const [tenantId, setTenantId] = useState(invoice.tenantId ?? "");
  const [accountingAccountId, setAccountingAccountId] = useState(invoice.accountingAccountId ?? "");
  const [leaseId] = useState(invoice.leaseId ?? "");

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Pay modal
  const [payOpen, setPayOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().substring(0, 10));
  const [payBankAccountId, setPayBankAccountId] = useState(invoice.bankAccountId ?? "");
  const [payReference, setPayReference] = useState("");

  // Pour les factures fournisseurs, toutes les catégories de la société sont disponibles
  const filteredCategories = categories;

  function handleSave() {
    startSave(async () => {
      const result = await updateSupplierInvoiceData(societyId, {
        id: invoice.id,
        supplierName: supplierName || null,
        supplierIban: editIban && supplierIban ? supplierIban : undefined,
        supplierBic: supplierBic || null,
        invoiceNumber: invoiceNumber || null,
        invoiceDate: invoiceDate || null,
        dueDate: dueDate || null,
        amountHT: amountHT ? parseFloat(amountHT) : null,
        amountVAT: amountVAT ? parseFloat(amountVAT) : null,
        amountTTC: amountTTC ? parseFloat(amountTTC) : null,
        vatRate: vatRate ? parseFloat(vatRate) : null,
        description: description || null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        buildingId: buildingId || null,
        categoryId: categoryId || null,
        tenantId: tenantId || null,
        accountingAccountId: accountingAccountId || null,
        leaseId: leaseId || null,
      });
      if (result.success) {
        toast.success("Facture mise à jour");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la sauvegarde");
      }
    });
  }

  function handleValidate() {
    startValidate(async () => {
      const result = await validateSupplierInvoice(societyId, invoice.id);
      if (result.success) {
        toast.success("Facture validée — une charge a été créée");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la validation");
      }
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Veuillez indiquer une raison de rejet");
      return;
    }
    startReject(async () => {
      const result = await rejectSupplierInvoice(societyId, invoice.id, rejectReason);
      if (result.success) {
        toast.success("Facture rejetée");
        setRejectOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors du rejet");
      }
    });
  }

  function handleMarkPaid() {
    if (!payBankAccountId) {
      toast.error("Veuillez sélectionner un compte bancaire");
      return;
    }
    startPay(async () => {
      const result = await markSupplierInvoicePaid(societyId, {
        invoiceId: invoice.id,
        paidAt,
        bankAccountId: payBankAccountId,
        reference: payReference || null,
      });
      if (result.success) {
        toast.success("Facture marquée comme payée");
        setPayOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors du marquage");
      }
    });
  }

  function handleQontoPay(bankAccountId: string) {
    startQontoPay(async () => {
      const result = await initiateQontoPayment(societyId, invoice.id, bankAccountId);
      if (result.success) {
        toast.success("Virement Qonto initié avec succès");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors du virement Qonto");
      }
    });
  }

  const qontoAccounts = bankAccounts.filter((ba) => ba.qontoAccountId);

  return (
    <>
      <div className="space-y-4">
        {/* Indication IA */}
        {isAI && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-700">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Données extraites automatiquement par IA (confiance : {Math.round((invoice.aiConfidence ?? 0) * 100)} %)</span>
          </div>
        )}

        {/* Infos fournisseur */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Fournisseur
              {isAI && <Badge variant="default" className="text-[10px] px-1.5 py-0.5 gap-1"><Sparkles className="h-2.5 w-2.5" />IA</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="supplierName" className="text-xs">Nom du fournisseur *</Label>
              <Input
                id="supplierName"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={isReadonly}
                placeholder="SARL Dupont Plomberie"
                className="mt-1 h-8 text-sm"
              />
            </div>

            {/* IBAN */}
            <div>
              <Label className="text-xs">IBAN fournisseur</Label>
              {invoice.hasIban && !editIban ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-8 rounded-md border border-border/60 bg-muted/30 px-3 flex items-center text-sm font-mono text-muted-foreground tracking-wider">
                    •••• •••• •••• ••••
                  </div>
                  {!isReadonly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setEditIban(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={supplierIban}
                    onChange={(e) => setSupplierIban(e.target.value.toUpperCase())}
                    disabled={isReadonly}
                    placeholder="FR76 1234 5678 9012 3456 7890 1"
                    className="h-8 text-sm font-mono"
                  />
                  {invoice.hasIban && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setEditIban(false)}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="supplierBic" className="text-xs">BIC / SWIFT</Label>
              <Input
                id="supplierBic"
                value={supplierBic}
                onChange={(e) => setSupplierBic(e.target.value.toUpperCase())}
                disabled={isReadonly}
                placeholder="BNPAFRPP"
                className="mt-1 h-8 text-sm font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* Détails facture */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Détails de la facture
              {isAI && <Badge variant="default" className="text-[10px] px-1.5 py-0.5 gap-1"><Sparkles className="h-2.5 w-2.5" />IA</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="invoiceNumber" className="text-xs">N° facture</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={isReadonly}
                  placeholder="FA-2024-001"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="invoiceDate" className="text-xs">Date facture *</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  disabled={isReadonly}
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dueDate" className="text-xs">Date d&apos;échéance</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isReadonly}
                className="mt-1 h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="amountHT" className="text-xs">Montant HT (€)</Label>
                <Input
                  id="amountHT"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountHT}
                  onChange={(e) => setAmountHT(e.target.value)}
                  disabled={isReadonly}
                  placeholder="0.00"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="vatRate" className="text-xs">TVA (%)</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  disabled={isReadonly}
                  placeholder="20"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="amountTTC" className="text-xs">Montant TTC (€) *</Label>
                <Input
                  id="amountTTC"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountTTC}
                  onChange={(e) => setAmountTTC(e.target.value)}
                  disabled={isReadonly}
                  placeholder="0.00"
                  className="mt-1 h-8 text-sm font-semibold"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-xs">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isReadonly}
                placeholder="Travaux de plomberie, interventions…"
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="periodStart" className="text-xs">Début de période</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  disabled={isReadonly}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="periodEnd" className="text-xs">Fin de période</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  disabled={isReadonly}
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tagging */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Affectation comptable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="buildingId" className="text-xs">Immeuble *</Label>
              <NativeSelect
                id="buildingId"
                value={buildingId}
                onChange={(e) => {
                  setBuildingId(e.target.value);
                  setCategoryId("");
                }}
                disabled={isReadonly}
                options={buildings.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="Sélectionner un immeuble"
                className="mt-1 h-8 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="tenantId" className="text-xs">Locataire</Label>
              <NativeSelect
                id="tenantId"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={isReadonly}
                options={tenants.map((t) => ({ value: t.id, label: t.label }))}
                placeholder="Sélectionner un locataire (optionnel)"
                className="mt-1 h-8 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="accountingAccountId" className="text-xs">Compte comptable *</Label>
              <NativeSelect
                id="accountingAccountId"
                value={accountingAccountId}
                onChange={(e) => setAccountingAccountId(e.target.value)}
                disabled={isReadonly}
                options={accountingAccounts.map((a) => ({
                  value: a.id,
                  label: `${a.code} — ${a.label}`,
                }))}
                placeholder="Sélectionner un compte (classe 6)"
                className="mt-1 h-8 text-sm"
              />
              {accountingAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Aucun compte de classe 6 — créez-les dans Comptabilité → Comptes
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="categoryId" className="text-xs">Catégorie (optionnel)</Label>
              <NativeSelect
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isReadonly}
                options={filteredCategories.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.nature})`,
                }))}
                placeholder="Sélectionner une catégorie"
                className="mt-1 h-8 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bouton sauvegarder */}
        {!isReadonly && (
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            className="w-full"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Sauvegarder les modifications
          </Button>
        )}

        <Separator />

        {/* Actions selon statut */}
        {invoice.status === "PENDING_REVIEW" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Actions
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleValidate}
                disabled={validating}
                className="flex-1 gap-1.5 bg-[var(--color-status-positive)] hover:bg-[var(--color-status-positive)]/90 text-white"
              >
                {validating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Valider
              </Button>
              <Button
                onClick={() => setRejectOpen(true)}
                disabled={rejecting}
                variant="outline"
                className="flex-1 gap-1.5 border-[var(--color-status-negative)] text-[var(--color-status-negative)] hover:bg-[var(--color-status-negative-bg)]"
              >
                <XCircle className="h-4 w-4" />
                Rejeter
              </Button>
            </div>
          </div>
        )}

        {invoice.status === "VALIDATED" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Paiement
            </p>

            {/* SEPA XML */}
            <a href={`/api/supplier-invoices/${invoice.id}/sepa-xml`} download>
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <Download className="h-4 w-4" />
                Télécharger SEPA XML
              </Button>
            </a>

            {/* Paiement Qonto */}
            {qontoAccounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Payer via Qonto</p>
                {qontoAccounts.map((ba) => (
                  <Button
                    key={ba.id}
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 justify-start"
                    onClick={() => handleQontoPay(ba.id)}
                    disabled={qontoPaying || !invoice.hasIban}
                  >
                    {qontoPaying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {ba.accountName} ({ba.bankName})
                  </Button>
                ))}
                {!invoice.hasIban && (
                  <p className="text-xs text-[var(--color-status-caution)] flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    IBAN requis pour payer via Qonto
                  </p>
                )}
              </div>
            )}

            {/* Paiement manuel */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setPayOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Marquer comme payé manuellement
            </Button>

            {invoice.validatedAt && (
              <p className="text-xs text-muted-foreground text-center">
                Validée le{" "}
                {new Date(invoice.validatedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        )}

        {invoice.status === "PAID" && (
          <div className="rounded-lg bg-[var(--color-status-positive-bg)] border border-[var(--color-status-positive)]/20 p-3 space-y-1">
            <p className="text-sm font-medium text-[var(--color-status-positive)] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Facture payée
            </p>
            {invoice.paymentExecutedAt && (
              <p className="text-xs text-muted-foreground">
                Le {new Date(invoice.paymentExecutedAt).toLocaleDateString("fr-FR")}
                {invoice.paymentMethod === "QONTO" ? " via Qonto" : " (manuel)"}
                {invoice.paymentReference ? ` · Réf. ${invoice.paymentReference}` : ""}
              </p>
            )}
          </div>
        )}

        {invoice.status === "REJECTED" && (
          <div className="rounded-lg bg-[var(--color-status-negative-bg)] border border-[var(--color-status-negative)]/20 p-3 space-y-1">
            <p className="text-sm font-medium text-[var(--color-status-negative)] flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Facture rejetée
            </p>
            {invoice.rejectionReason && (
              <p className="text-xs text-muted-foreground">{invoice.rejectionReason}</p>
            )}
            {invoice.rejectedAt && (
              <p className="text-xs text-muted-foreground">
                Le {new Date(invoice.rejectedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal rejet */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter la facture</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Indiquez la raison du rejet. Elle sera conservée dans l&apos;historique.
            </p>
            <div>
              <Label htmlFor="rejectReason" className="text-xs">Raison du rejet *</Label>
              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Facture en doublon, montant incorrect, mauvais fournisseur…"
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
              className="gap-1.5 bg-[var(--color-status-negative)] hover:bg-[var(--color-status-negative)]/90 text-white"
            >
              {rejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal paiement manuel */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marquer comme payé</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="paidAt" className="text-xs">Date de paiement *</Label>
              <Input
                id="paidAt"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label htmlFor="payBankAccountId" className="text-xs">Compte bancaire *</Label>
              <NativeSelect
                id="payBankAccountId"
                value={payBankAccountId}
                onChange={(e) => setPayBankAccountId(e.target.value)}
                options={bankAccounts.map((ba) => ({
                  value: ba.id,
                  label: `${ba.accountName} (${ba.bankName})`,
                }))}
                placeholder="Sélectionner un compte"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label htmlFor="payReference" className="text-xs">Référence de paiement</Label>
              <Input
                id="payReference"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="N° chèque, virement…"
                className="mt-1 h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={paying || !payBankAccountId}
              className="gap-1.5"
            >
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
