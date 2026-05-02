"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Archive, Loader2 } from "lucide-react";
import { createFixedAsset } from "@/actions/fixed-asset";
import { REAL_ESTATE_FIXED_ASSET_PRESETS } from "@/lib/fixed-assets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type BuildingOption = { id: string; name: string };
type AccountOption = { id: string; code: string; label: string; type: string };
type SupplierInvoicePrefill = {
  id: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  amountHT: number | null;
  amountTTC: number | null;
  description: string | null;
  buildingId: string | null;
  accountingAccountId: string | null;
  journalEntryId: string | null;
  accountingAccount: { type: string } | null;
} | null;

type FixedAssetFormProps = {
  societyId: string;
  buildings: BuildingOption[];
  accounts: AccountOption[];
  supplierInvoice: SupplierInvoicePrefill;
};

type FixedAssetCategoryKey =
  | "STRUCTURE"
  | "FACADE_TOITURE"
  | "INSTALLATIONS_TECHNIQUES"
  | "AGENCEMENTS_AMENAGEMENTS"
  | "MOBILIER_EQUIPEMENTS"
  | "TRAVAUX_COPROPRIETE"
  | "AUTRE";

const FIXED_ASSET_CATEGORIES: FixedAssetCategoryKey[] = [
  "STRUCTURE",
  "FACADE_TOITURE",
  "INSTALLATIONS_TECHNIQUES",
  "AGENCEMENTS_AMENAGEMENTS",
  "MOBILIER_EQUIPEMENTS",
  "TRAVAUX_COPROPRIETE",
  "AUTRE",
];

const CATEGORY_OPTIONS = FIXED_ASSET_CATEGORIES.map((value) => ({
  value,
  label: REAL_ESTATE_FIXED_ASSET_PRESETS[value].label,
}));

function toInputDate(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

function findAccountByPrefix(accounts: AccountOption[], prefix: string): string {
  return accounts.find((account) => account.code.startsWith(prefix))?.id ?? "";
}

function isFixedAssetCategory(value: string): value is FixedAssetCategoryKey {
  return FIXED_ASSET_CATEGORIES.some((category) => category === value);
}

export function FixedAssetForm({
  societyId,
  buildings,
  accounts,
  supplierInvoice,
}: FixedAssetFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialCategory: FixedAssetCategoryKey = supplierInvoice ? "TRAVAUX_COPROPRIETE" : "AGENCEMENTS_AMENAGEMENTS";
  const initialPreset = REAL_ESTATE_FIXED_ASSET_PRESETS[initialCategory];

  const assetAccounts = accounts.filter((account) => account.type === "2" && !account.code.startsWith("28"));
  const depreciationAccounts = accounts.filter((account) => account.type === "2" && account.code.startsWith("28"));
  const expenseAccounts = accounts.filter((account) => account.type === "6" && account.code.startsWith("681"));
  const invoiceBase = supplierInvoice?.amountHT ?? supplierInvoice?.amountTTC ?? 0;

  const [name, setName] = useState(
    supplierInvoice
      ? `${supplierInvoice.description || supplierInvoice.supplierName || "Travaux immobilisés"}`
      : ""
  );
  const [description, setDescription] = useState(supplierInvoice?.description ?? "");
  const [category, setCategory] = useState<FixedAssetCategoryKey>(initialCategory);
  const [buildingId, setBuildingId] = useState(supplierInvoice?.buildingId ?? buildings[0]?.id ?? "");
  const [assetAccountId, setAssetAccountId] = useState(
    supplierInvoice?.accountingAccount?.type === "2" && supplierInvoice.accountingAccountId
      ? supplierInvoice.accountingAccountId
      : findAccountByPrefix(assetAccounts, initialPreset.assetAccountPrefix)
  );
  const [depreciationAccountId, setDepreciationAccountId] = useState(
    findAccountByPrefix(depreciationAccounts, initialPreset.depreciationAccountPrefix)
  );
  const [expenseAccountId, setExpenseAccountId] = useState(findAccountByPrefix(expenseAccounts, "681"));
  const [acquisitionDate, setAcquisitionDate] = useState(toInputDate(supplierInvoice?.invoiceDate));
  const [serviceStartDate, setServiceStartDate] = useState(toInputDate(supplierInvoice?.invoiceDate));
  const [depreciableBase, setDepreciableBase] = useState(invoiceBase > 0 ? String(invoiceBase) : "");
  const [residualValue, setResidualValue] = useState("0");
  const [durationMonths, setDurationMonths] = useState(String(initialPreset.defaultDurationMonths));

  const preview = useMemo(() => {
    const base = Number.parseFloat(depreciableBase) || 0;
    const duration = Number.parseInt(durationMonths, 10) || 0;
    return duration > 0 ? base / duration * 12 : 0;
  }, [depreciableBase, durationMonths]);

  function handleCategoryChange(nextCategory: FixedAssetCategoryKey) {
    const preset = REAL_ESTATE_FIXED_ASSET_PRESETS[nextCategory] ?? REAL_ESTATE_FIXED_ASSET_PRESETS.AUTRE;
    setCategory(nextCategory);
    setDurationMonths(String(preset.defaultDurationMonths));
    const assetAccount = findAccountByPrefix(assetAccounts, preset.assetAccountPrefix);
    const depreciationAccount = findAccountByPrefix(depreciationAccounts, preset.depreciationAccountPrefix);
    if (assetAccount) setAssetAccountId(assetAccount);
    if (depreciationAccount) setDepreciationAccountId(depreciationAccount);
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error("Le nom est obligatoire"); return; }
    if (!buildingId) { toast.error("Sélectionnez un immeuble"); return; }
    if (!assetAccountId || !depreciationAccountId || !expenseAccountId) {
      toast.error("Les comptes d'immobilisation, amortissement et dotation sont obligatoires");
      return;
    }

    startTransition(async () => {
      const result = await createFixedAsset(societyId, {
        name,
        description: description || undefined,
        category,
        buildingId,
        supplierInvoiceId: supplierInvoice?.id,
        acquisitionJournalEntryId: supplierInvoice?.journalEntryId ?? undefined,
        assetAccountId,
        depreciationAccountId,
        expenseAccountId,
        acquisitionDate: new Date(acquisitionDate),
        serviceStartDate: new Date(serviceStartDate),
        depreciableBase: Number.parseFloat(depreciableBase),
        residualValue: Number.parseFloat(residualValue) || 0,
        durationMonths: Number.parseInt(durationMonths, 10),
      });

      if (result.success) {
        toast.success("Immobilisation créée avec son plan d'amortissement");
        router.push("/comptabilite/immobilisations");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la création");
      }
    });
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/comptabilite/immobilisations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Archive className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Nouvelle immobilisation</h1>
          <p className="text-sm text-muted-foreground">
            Créez le composant immobilier et son plan de dotations annuel.
          </p>
        </div>
      </div>

      {supplierInvoice && (
        <Card>
          <CardContent className="pt-4 text-sm">
            Facture source : <span className="font-medium">{supplierInvoice.supplierName ?? "Fournisseur"}</span>
            {supplierInvoice.invoiceNumber ? ` · ${supplierInvoice.invoiceNumber}` : ""}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paramètres d'amortissement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Intitulé *</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="category">Nature immobilière *</Label>
            <NativeSelect
              id="category"
              value={category}
              onChange={(event) => {
                if (isFixedAssetCategory(event.target.value)) handleCategoryChange(event.target.value);
              }}
              options={CATEGORY_OPTIONS}
            />
          </div>
          <div>
            <Label htmlFor="buildingId">Immeuble *</Label>
            <NativeSelect
              id="buildingId"
              value={buildingId}
              onChange={(event) => setBuildingId(event.target.value)}
              placeholder="Sélectionner un immeuble"
              options={buildings.map((building) => ({ value: building.id, label: building.name }))}
            />
          </div>
          <div>
            <Label htmlFor="acquisitionDate">Date d'acquisition *</Label>
            <Input id="acquisitionDate" type="date" value={acquisitionDate} onChange={(event) => setAcquisitionDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="serviceStartDate">Date de mise en service *</Label>
            <Input id="serviceStartDate" type="date" value={serviceStartDate} onChange={(event) => setServiceStartDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="depreciableBase">Base amortissable HT *</Label>
            <Input id="depreciableBase" type="number" min="0" step="0.01" value={depreciableBase} onChange={(event) => setDepreciableBase(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="residualValue">Valeur résiduelle</Label>
            <Input id="residualValue" type="number" min="0" step="0.01" value={residualValue} onChange={(event) => setResidualValue(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="durationMonths">Durée d'amortissement (mois) *</Label>
            <Input id="durationMonths" type="number" min="1" max="1200" value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} />
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-muted-foreground">Dotation annuelle indicative</div>
            <div className="mt-1 font-mono text-lg">{preview.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comptabilisation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="assetAccountId">Compte immobilisation *</Label>
            <NativeSelect
              id="assetAccountId"
              value={assetAccountId}
              onChange={(event) => setAssetAccountId(event.target.value)}
              placeholder="Classe 2"
              options={assetAccounts.map((account) => ({ value: account.id, label: `${account.code} — ${account.label}` }))}
            />
          </div>
          <div>
            <Label htmlFor="depreciationAccountId">Compte amortissement *</Label>
            <NativeSelect
              id="depreciationAccountId"
              value={depreciationAccountId}
              onChange={(event) => setDepreciationAccountId(event.target.value)}
              placeholder="Compte 28"
              options={depreciationAccounts.map((account) => ({ value: account.id, label: `${account.code} — ${account.label}` }))}
            />
          </div>
          <div>
            <Label htmlFor="expenseAccountId">Compte dotation *</Label>
            <NativeSelect
              id="expenseAccountId"
              value={expenseAccountId}
              onChange={(event) => setExpenseAccountId(event.target.value)}
              placeholder="Compte 681"
              options={expenseAccounts.map((account) => ({ value: account.id, label: `${account.code} — ${account.label}` }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/comptabilite/immobilisations">Annuler</Link>
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Créer l'immobilisation
        </Button>
      </div>
    </div>
  );
}
