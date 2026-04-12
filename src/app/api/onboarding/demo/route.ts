import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/**
 * POST /api/onboarding/demo
 * Crée des données de démonstration pour le wizard d'onboarding.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;

  if (!societyId) {
    return NextResponse.json({ error: "Aucune société active" }, { status: 400 });
  }

  // Vérifier que la société appartient bien à l'utilisateur
  const userSociety = await prisma.userSociety.findUnique({
    where: { userId_societyId: { userId: session.user.id, societyId } },
  });
  if (!userSociety) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Vérifier qu'il n'y a pas déjà des données
  const existingBuildings = await prisma.building.count({ where: { societyId } });
  if (existingBuildings > 0) {
    return NextResponse.json({ data: { message: "Des données existent déjà" } });
  }

  // Créer des données de démonstration
  const building = await prisma.building.create({
    data: {
      societyId,
      name: "Résidence Les Orchidées (démo)",
      addressLine1: "12 rue des Flamboyants",
      city: "Saint-Denis",
      postalCode: "97400",
      country: "France",
      buildingType: "MIXTE",
    },
  });

  const lot1 = await prisma.lot.create({
    data: {
      buildingId: building.id,
      number: "201",
      lotType: "APPARTEMENT",
      area: 65,
      description: "Apt T3 — 2e étage gauche (démo)",
      status: "OCCUPE",
      currentRent: 850,
    },
  });

  const lot2 = await prisma.lot.create({
    data: {
      buildingId: building.id,
      number: "101",
      lotType: "APPARTEMENT",
      area: 45,
      description: "Apt T2 — 1er étage droit (démo)",
      status: "VACANT",
      currentRent: 650,
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      societyId,
      entityType: "PERSONNE_PHYSIQUE",
      firstName: "Marie",
      lastName: "Dupont (démo)",
      email: "demo-locataire@mygestia.example",
      phone: "0692 00 00 00",
    },
  });

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const endDate = new Date(now.getFullYear() + 2, now.getMonth() - 6, 1);

  await prisma.lease.create({
    data: {
      societyId,
      lotId: lot1.id,
      tenantId: tenant.id,
      leaseType: "HABITATION",
      status: "EN_COURS",
      startDate,
      endDate,
      baseRentHT: 850,
      currentRentHT: 850,
      depositAmount: 850,
    },
  });

  return NextResponse.json({
    data: {
      message: "Données de démonstration créées",
      buildingId: building.id,
      lotIds: [lot1.id, lot2.id],
      tenantId: tenant.id,
    },
  });
}
