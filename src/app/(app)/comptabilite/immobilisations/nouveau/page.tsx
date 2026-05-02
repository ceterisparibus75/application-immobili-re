import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { FixedAssetForm } from "../_components/fixed-asset-form";

export const metadata = { title: "Nouvelle immobilisation" };

type PageProps = {
  searchParams?: Promise<{ supplierInvoiceId?: string }>;
};

export default async function NewFixedAssetPage({ searchParams }: PageProps) {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();
  if (!societyId) redirect("/societes");
  if (!session?.user?.id) return null;

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch {
    return null;
  }

  const supplierInvoiceId = (await searchParams)?.supplierInvoiceId;
  const [buildings, accounts, supplierInvoice] = await Promise.all([
    prisma.building.findMany({
      where: { societyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.accountingAccount.findMany({
      where: { societyId, isActive: true, type: { in: ["2", "6"] } },
      select: { id: true, code: true, label: true, type: true },
      orderBy: { code: "asc" },
    }),
    supplierInvoiceId
      ? prisma.supplierInvoice.findFirst({
          where: { id: supplierInvoiceId, societyId },
          select: {
            id: true,
            supplierName: true,
            invoiceNumber: true,
            invoiceDate: true,
            amountHT: true,
            amountTTC: true,
            description: true,
            buildingId: true,
            accountingAccountId: true,
            journalEntryId: true,
            accountingAccount: { select: { type: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  if (supplierInvoiceId && !supplierInvoice) notFound();

  return (
    <FixedAssetForm
      societyId={societyId}
      buildings={buildings}
      accounts={accounts}
      supplierInvoice={supplierInvoice}
    />
  );
}
