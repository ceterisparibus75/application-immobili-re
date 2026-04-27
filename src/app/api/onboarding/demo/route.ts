import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { encrypt } from "@/lib/encryption";

/**
 * POST /api/onboarding/demo
 * Crée des données de démonstration pour le wizard d'onboarding.
 */
export async function POST() {
  const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
  if (context instanceof NextResponse) return context;

  const { societyId } = context;

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

  const lease = await prisma.lease.create({
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

  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 5);

  const invoice = await prisma.invoice.create({
    data: {
      societyId,
      leaseId: lease.id,
      tenantId: tenant.id,
      invoiceNumber: `DEMO-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      invoiceType: "QUITTANCE",
      status: "PAYE",
      issueDate: periodStart,
      dueDate,
      periodStart,
      periodEnd,
      totalHT: 850,
      totalVAT: 0,
      totalTTC: 850,
      validatedAt: periodStart,
      sentAt: periodStart,
      sentBy: tenant.email,
      lines: {
        create: [
          {
            label: "Loyer mensuel - données démo",
            quantity: 1,
            unitPrice: 850,
            vatRate: 0,
            totalHT: 850,
            totalVAT: 0,
            totalTTC: 850,
            accountingAccountCode: "706000",
          },
        ],
      },
    },
  });

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: 850,
      paidAt: dueDate,
      method: "virement",
      reference: "VIR-DEMO-LOYER-850",
      notes: "Paiement de démonstration rapproché automatiquement",
      isReconciled: true,
    },
  });

  const bankAccount = await prisma.bankAccount.create({
    data: {
      societyId,
      bankName: "Banque Démo",
      accountName: "Compte loyers - démo",
      ibanEncrypted: encrypt("FR7612345123451234567890138"),
      initialBalance: 12500,
      currentBalance: 13350,
    },
  });

  const transaction = await prisma.bankTransaction.create({
    data: {
      bankAccountId: bankAccount.id,
      transactionDate: dueDate,
      valueDate: dueDate,
      amount: 850,
      label: "VIR SEPA MARIE DUPONT LOYER DEMO",
      reference: "VIR-DEMO-LOYER-850",
      category: "LOYERS",
      isReconciled: true,
      importBatch: "demo-onboarding",
      externalId: `demo-${societyId}-${now.getFullYear()}-${now.getMonth() + 1}`,
    },
  });

  await prisma.bankReconciliation.create({
    data: {
      transactionId: transaction.id,
      paymentId: payment.id,
      isValidated: true,
      validatedAt: dueDate,
      notes: "Rapprochement de démonstration",
    },
  });

  return NextResponse.json({
    data: {
      message: "Données de démonstration créées",
      buildingId: building.id,
      lotIds: [lot1.id, lot2.id],
      tenantId: tenant.id,
      leaseId: lease.id,
      invoiceId: invoice.id,
      bankAccountId: bankAccount.id,
    },
  });
}
