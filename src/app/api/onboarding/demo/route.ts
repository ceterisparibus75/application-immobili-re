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
      address: "12 rue des Flamboyants",
      city: "Saint-Denis",
      zipCode: "97400",
      country: "FR",
      type: "RESIDENTIAL",
      floors: 3,
      constructionYear: 2015,
    },
  });

  const lot1 = await prisma.lot.create({
    data: {
      societyId,
      buildingId: building.id,
      label: "Apt T3 — 2e étage gauche (démo)",
      type: "HABITATION",
      surface: 65,
      rooms: 3,
      floor: 2,
      status: "OCCUPE",
      baseRent: 850,
      charges: 120,
    },
  });

  const lot2 = await prisma.lot.create({
    data: {
      societyId,
      buildingId: building.id,
      label: "Apt T2 — 1er étage droit (démo)",
      type: "HABITATION",
      surface: 45,
      rooms: 2,
      floor: 1,
      status: "LIBRE",
      baseRent: 650,
      charges: 90,
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      societyId,
      firstName: "Marie",
      lastName: "Dupont (démo)",
      email: "demo-locataire@mygestia.example",
      phone: "0692 00 00 00",
      type: "PARTICULIER",
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
      type: "HABITATION_VIDE",
      status: "ACTIF",
      startDate,
      endDate,
      rentAmount: 850,
      chargesAmount: 120,
      paymentDay: 5,
      revisionIndex: "IRL",
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
