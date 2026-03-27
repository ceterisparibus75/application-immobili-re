import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { UploadDocumentForm } from "./_form";

export default async function NouveauDocumentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  // Vérification des droits AVANT de charger quoi que ce soit
  await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

  // Toutes les données chargées côté serveur, scopées à la société active
  const [buildings, lots, leases, tenants] = await Promise.all([
    prisma.building.findMany({
      where: { societyId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
    prisma.lot.findMany({
      where: { building: { societyId } },
      select: { id: true, number: true, building: { select: { id: true, name: true } } },
      orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
    }),
    prisma.lease.findMany({
      where: { societyId, status: "EN_COURS" },
      select: {
        id: true,
        lot: { select: { number: true, building: { select: { name: true } } } },
        tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.tenant.findMany({
      where: { societyId, isActive: true },
      select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true },
      orderBy: [{ lastName: "asc" }, { companyName: "asc" }],
    }),
  ]);

  // Formatter les labels côté serveur
  const leaseOptions = leases.map((l) => {
    const t = l.tenant;
    const tenantName =
      t.entityType === "PERSONNE_MORALE"
        ? (t.companyName ?? "Locataire")
        : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim();
    return {
      id: l.id,
      label: `Lot ${l.lot.number} — ${l.lot.building.name} · ${tenantName}`,
    };
  });

  const tenantOptions = tenants.map((t) => ({
    id: t.id,
    label:
      t.entityType === "PERSONNE_MORALE"
        ? (t.companyName ?? "Locataire")
        : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
  }));

  const lotOptions = lots.map((l) => ({
    id: l.id,
    label: `Lot ${l.number} — ${l.building.name}`,
    buildingId: l.building.id,
  }));

  return (
    <UploadDocumentForm
      societyId={societyId}
      buildings={buildings}
      lots={lotOptions}
      leases={leaseOptions}
      tenants={tenantOptions}
    />
  );
}
