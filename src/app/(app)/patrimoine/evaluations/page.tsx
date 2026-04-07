import { getBuildings } from "@/actions/building";
import { getLeases } from "@/actions/lease";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BatchEvaluationClient } from "./_components/batch-evaluation-client";

export const metadata = { title: "Évaluations en lot" };

export default async function BatchEvaluationPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const [buildings, leases] = await Promise.all([
    getBuildings(societyId),
    getLeases(societyId),
  ]);

  const activeLeases = leases.filter((l) => l.status === "EN_COURS");

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Évaluations en lot</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Lancez des évaluations IA sur plusieurs immeubles ou baux en une seule fois
        </p>
      </div>
      <BatchEvaluationClient
        societyId={societyId}
        buildings={buildings.map((b) => ({
          id: b.id,
          name: b.name,
          city: b.city,
          buildingType: b.buildingType,
          lotCount: b._count.lots,
        }))}
        leases={activeLeases.map((l) => ({
          id: l.id,
          tenantName: l.tenant.entityType === "PERSONNE_MORALE"
            ? l.tenant.companyName ?? "N/A"
            : `${l.tenant.firstName ?? ""} ${l.tenant.lastName ?? ""}`.trim() || "N/A",
          buildingName: l.lot.building.name,
          lotNumber: l.lot.number,
          leaseType: l.leaseType,
          currentRentHT: l.currentRentHT,
          paymentFrequency: l.paymentFrequency,
        }))}
      />
    </div>
  );
}
