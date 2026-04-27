import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { CandidateForm } from "../_components/candidate-form";

export const metadata: Metadata = { title: "Nouvelle candidature" };

export default async function NewCandidatePage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  if (!societyId) redirect("/societes");
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

  const vacantLots = await prisma.lot.findMany({
    where: {
      status: "VACANT",
      building: { societyId },
    },
    select: {
      id: true,
      number: true,
      lotType: true,
      area: true,
      building: {
        select: {
          name: true,
          city: true,
        },
      },
    },
    orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
    take: 200,
  });

  return (
    <div className="max-w-5xl">
      <CandidateForm
        societyId={societyId}
        lots={vacantLots.map((lot) => ({
          value: lot.id,
          label: `${lot.building.name} - lot ${lot.number} (${lot.lotType}, ${lot.area} m2)`,
        }))}
      />
    </div>
  );
}
