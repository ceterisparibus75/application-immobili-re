import { getInvoiceById } from "@/actions/invoice";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { EditDraftForm } from "./_components/edit-draft-form";

function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ModifierBrouillonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const invoice = await getInvoiceById(societyId, id);
  if (!invoice) notFound();
  if (invoice.status !== "BROUILLON") redirect(`/facturation/${id}`);

  return (
    <EditDraftForm
      invoiceId={invoice.id}
      societyId={societyId}
      hasLease={!!invoice.leaseId}
      invoiceNumber={invoice.invoiceNumber}
      issueDate={toDateInput(invoice.issueDate)}
      dueDate={toDateInput(invoice.dueDate)}
      periodStart={toDateInput(invoice.periodStart)}
      periodEnd={toDateInput(invoice.periodEnd)}
      initialLines={invoice.lines.map((l) => ({
        label: l.label,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
      }))}
    />
  );
}