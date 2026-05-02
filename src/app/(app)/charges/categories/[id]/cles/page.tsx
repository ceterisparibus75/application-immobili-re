import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateAllocationKey } from "@/actions/allocation-key";
import { AllocationKeyForm } from "./_components/allocation-key-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Cles de repartition" };

export default async function AllocationKeysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const { id: categoryId } = await params;

  const category = await prisma.chargeCategory.findFirst({
    where: { id: categoryId, societyId },
    include: { building: { select: { name: true, id: true } } },
  });

  if (!category) notFound();

  const keyResult = await getOrCreateAllocationKey(societyId, categoryId);
  if (!keyResult.success) redirect("/charges");

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/charges">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Cles de repartition
          </h1>
          <p className="text-muted-foreground text-sm">
            {category.building.name} &middot; {category.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repartition par lot</CardTitle>
          <CardDescription>
            Definissez le pourcentage de charges de cette categorie impute a chaque lot.
            La somme doit etre egale a 100 %.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keyResult.data!.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun lot trouve pour cet immeuble.
            </p>
          ) : (
            <AllocationKeyForm
              societyId={societyId}
              categoryId={categoryId}
              categoryName={category.name}
              initialData={keyResult.data!}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}