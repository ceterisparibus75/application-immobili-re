import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePortalAuth } from "@/lib/portal-auth";

export async function GET() {
  try {
    const session = await requirePortalAuth();

    // Use the specific tenantId from the JWT session — never search across all societies
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Locataire introuvable" }, { status: 404 });
    }
    const tenantIds = [tenant.id];

    // Baux avec PDF
    const leases = await prisma.lease.findMany({
      where: { tenantId: { in: tenantIds } },
      select: {
        id: true,
        leaseType: true,
        status: true,
        startDate: true,
        endDate: true,
        currentRentHT: true,
        leaseFileUrl: true,
        lot: {
          select: {
            number: true,
            building: { select: { name: true, addressLine1: true, city: true } },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    // Factures (appels de loyer + quittances)
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: { in: tenantIds } },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        status: true,
        totalHT: true,
        totalTTC: true,
        issueDate: true,
        dueDate: true,
        fileUrl: true,
      },
      orderBy: { issueDate: "desc" },
      take: 100,
    });

    return NextResponse.json({ leases, invoices });
  } catch (error) {
    console.error("[portal/documents]", error);
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 });
  }
}
