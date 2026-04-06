import { getValuations } from "@/actions/valuation";
import { getBuildingById } from "@/actions/building";
import { CreateValuationButton } from "@/components/valuation/create-valuation-button";
import { ValuationList } from "@/components/valuation/valuation-list";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

export default async function ValorisationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const building = await getBuildingById(societyId, id);
  if (!building) notFound();

  const valuations = await getValuations(societyId, id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-[#94A3B8]">
        <Link href="/patrimoine/immeubles" className="hover:text-[var(--color-brand-deep)] transition-colors">
          Immeubles
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/patrimoine/immeubles/${id}`} className="hover:text-[var(--color-brand-deep)] transition-colors">
          {building.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--color-brand-deep)] font-medium">Valorisation</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Valorisation</h1>
          <p className="text-sm text-[#94A3B8]">
            Avis de valeur IA pour {building.name}
          </p>
        </div>
        <CreateValuationButton societyId={societyId} buildingId={id} />
      </div>

      {/* List */}
      <ValuationList
        valuations={valuations}
        buildingId={id}
        societyId={societyId}
      />
    </div>
  );
}
