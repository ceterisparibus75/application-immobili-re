import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { REAL_ESTATE_FIXED_ASSET_PRESETS } from "@/lib/fixed-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, CalendarClock, Plus, ReceiptText } from "lucide-react";
import { PostDepreciationButton } from "./_components/post-depreciation-button";

export const metadata = { title: "Immobilisations" };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "En cours",
  FULLY_DEPRECIATED: "Amortie",
  DISPOSED: "Sortie",
  ARCHIVED: "Archivée",
};

export default async function FixedAssetsPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();
  if (!societyId || !session?.user?.id) return null;

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch {
    return null;
  }

  const assets = await prisma.fixedAsset.findMany({
    where: { societyId },
    include: {
      building: { select: { name: true } },
      assetAccount: { select: { code: true } },
      depreciationAccount: { select: { code: true } },
      expenseAccount: { select: { code: true } },
      supplierInvoice: { select: { id: true, supplierName: true, invoiceNumber: true } },
      depreciationLines: { orderBy: { fiscalYear: "asc" } },
    },
    orderBy: [{ status: "asc" }, { serviceStartDate: "desc" }],
  });

  const totalGross = assets.reduce((sum, asset) => sum + asset.depreciableBase, 0);
  const postedDepreciation = assets.reduce(
    (sum, asset) => sum + asset.depreciationLines
      .filter((line) => line.status === "POSTED")
      .reduce((lineSum, line) => lineSum + line.amount, 0),
    0
  );
  const nextPlannedCount = assets.reduce(
    (sum, asset) => sum + asset.depreciationLines.filter((line) => line.status === "PLANNED").length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Archive className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Immobilisations</h1>
            <p className="text-sm text-muted-foreground">
              Suivi des travaux immobilisés, composants d'immeubles et dotations d'amortissement.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/comptabilite/immobilisations/nouveau">
            <Plus className="h-4 w-4" />
            Nouvelle immobilisation
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Base amortissable</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrency(totalGross)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Dotations comptabilisées</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrency(postedDepreciation)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Dotations à générer</div>
            <div className="mt-1 text-2xl font-semibold">{nextPlannedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registre des immobilisations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Immobilisation</TableHead>
                  <TableHead>Immeuble</TableHead>
                  <TableHead>Comptes</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead>Mise en service</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Aucune immobilisation enregistrée.
                    </TableCell>
                  </TableRow>
                ) : assets.map((asset) => {
                  const nextLine = asset.depreciationLines.find((line) => line.status === "PLANNED");
                  const preset = REAL_ESTATE_FIXED_ASSET_PRESETS[asset.category];
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="min-w-72">
                        <div className="font-medium">{asset.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{preset?.label ?? asset.category}</Badge>
                          <Badge variant={asset.status === "ACTIVE" ? "default" : "secondary"}>
                            {STATUS_LABELS[asset.status] ?? asset.status}
                          </Badge>
                        </div>
                        {asset.supplierInvoice && (
                          <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" asChild>
                            <Link href={`/banque/factures-fournisseurs/${asset.supplierInvoice.id}`}>
                              <ReceiptText className="h-3 w-3" />
                              {asset.supplierInvoice.supplierName ?? "Facture fournisseur"}
                              {asset.supplierInvoice.invoiceNumber ? ` ${asset.supplierInvoice.invoiceNumber}` : ""}
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{asset.building.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div>{asset.assetAccount.code}</div>
                        <div className="text-muted-foreground">
                          {asset.expenseAccount.code} / {asset.depreciationAccount.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(asset.depreciableBase)}</TableCell>
                      <TableCell>{formatDate(asset.serviceStartDate)}</TableCell>
                      <TableCell>
                        {nextLine ? (
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <span>{nextLine.fiscalYear} · {formatCurrency(nextLine.amount)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Plan terminé</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {nextLine && (
                          <PostDepreciationButton
                            societyId={societyId}
                            fixedAssetId={asset.id}
                            fiscalYear={nextLine.fiscalYear}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
