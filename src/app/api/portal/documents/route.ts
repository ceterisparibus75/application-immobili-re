import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePortalAuth } from "@/lib/portal-auth";

export async function GET() {
  try {
    const session = await requirePortalAuth();

    // Trouver TOUS les locataires avec cet email (multi-société)
    const tenants = await prisma.tenant.findMany({
      where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    const tenantIds = tenants.map((t) => t.id);

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
