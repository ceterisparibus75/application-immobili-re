import { getChargesPaginated } from "@/actions/charge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Euro, Plus, Receipt, BookOpen, FileBarChart2 } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { parsePaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { ChargesDataTable } from "./_components/charges-data-table";

export const metadata = { title: "Charges" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ChargesPage({ searchParams }: PageProps) {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const resolvedParams = await searchParams;
  const pagination = parsePaginationParams(resolvedParams);

  const [{ data: charges, total }, buildings, kpis] = await Promise.all([
    getChargesPaginated(societyId, {
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: pagination.search,
      sortBy: pagination.sortBy,
      sortOrder: pagination.sortOrder,
      filters: pagination.filters,
    }),
    prisma.building.findMany({
      where: { societyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.charge.aggregate({
      where: { societyId },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const unpaidCount = await prisma.charge.count({ where: { societyId, isPaid: false } });
  const totalAmount = kpis._sum.amount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Charges</h1>
          <p className="text-muted-foreground">{total} charge{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/charges/bibliotheque">
            <Button variant="outline" size="sm"><BookOpen className="h-4 w-4" />Bibliothèque</Button>
          </Link>
          <Link href="/charges/comptes-rendus">
            <Button variant="outline" size="sm"><FileBarChart2 className="h-4 w-4" />Comptes rendus</Button>
          </Link>
          <Link href="/charges/nouvelle">
            <Button><Plus className="h-4 w-4" />Nouvelle charge</Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total charges</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{kpis._count} entrée{kpis._count > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-[var(--color-status-negative)]" />
              <p className="text-xs text-muted-foreground">Non réglées</p>
            </div>
            <p className="text-xl font-bold text-[var(--color-status-negative)]">{unpaidCount}</p>
            <p className="text-xs text-muted-foreground">sur {kpis._count} charge{kpis._count > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      </div>

      {total === 0 && !pagination.search && Object.keys(pagination.filters ?? {}).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune charge</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Enregistrez les charges d&apos;exploitation de vos immeubles.
            </p>
            <div className="flex gap-3">
              <Link href="/charges/bibliotheque/nouvelle">
                <Button variant="outline"><BookOpen className="h-4 w-4" />Créer la bibliothèque</Button>
              </Link>
              <Link href="/charges/nouvelle">
                <Button><Plus className="h-4 w-4" />Nouvelle charge</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ChargesDataTable
          charges={charges.map((c) => ({
            id: c.id,
            description: c.description,
            amount: c.amount,
            date: c.date,
            supplierName: c.supplierName,
            isPaid: c.isPaid,
            categoryName: c.category.name,
            nature: c.category.nature,
            buildingName: c.building.name,
          }))}
          total={total}
          page={pagination.page}
          pageSize={pagination.pageSize}
          sortBy={pagination.sortBy}
          sortOrder={pagination.sortOrder}
          search={pagination.search}
          activeFilters={pagination.filters}
          buildings={buildings}
        />
      )}
    </div>
  );
}
