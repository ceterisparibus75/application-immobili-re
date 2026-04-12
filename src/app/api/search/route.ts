import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export interface SearchResult {
  id: string;
  type: "building" | "lot" | "tenant" | "lease" | "invoice" | "contact" | "document";
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json({ error: "Societe non selectionnee" }, { status: 400 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const typeFilter = url.searchParams.get("type")?.trim() ?? "";
  const results: SearchResult[] = [];

  // Immeubles
  if (!typeFilter || typeFilter === "building") {
    const buildings = await prisma.building.findMany({
      where: {
        societyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { addressLine1: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      select: { id: true, name: true, addressLine1: true, city: true },
    });
    for (const b of buildings) {
      results.push({
        id: b.id, type: "building",
        title: b.name, subtitle: [b.addressLine1, b.city].filter(Boolean).join(", "),
        href: `/patrimoine/immeubles/${b.id}`,
      });
    }
  }

  // Lots
  if (!typeFilter || typeFilter === "lot") {
    const lots = await prisma.lot.findMany({
      where: {
        building: { societyId },
        OR: [
          { number: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      include: { building: { select: { name: true } } },
    });
    for (const l of lots) {
      results.push({
        id: l.id, type: "lot",
        title: l.number ?? l.id,
        subtitle: l.building.name,
        href: `/patrimoine/immeubles/${l.buildingId}/lots/${l.id}`,
      });
    }
  }

  // Locataires
  if (!typeFilter || typeFilter === "tenant") {
    const tenants = await prisma.tenant.findMany({
      where: {
        societyId,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
    });
    for (const t of tenants) {
      results.push({
        id: t.id, type: "tenant",
        title: t.entityType === "PERSONNE_MORALE"
          ? (t.companyName ?? t.id)
          : [t.firstName, t.lastName].filter(Boolean).join(" "),
        subtitle: t.email ?? undefined,
        href: `/locataires/${t.id}`,
      });
    }
  }

  // Factures
  if (!typeFilter || typeFilter === "invoice") {
    const invoices = await prisma.invoice.findMany({
      where: {
        societyId,
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { tenant: { firstName: { contains: q, mode: "insensitive" } } },
          { tenant: { lastName: { contains: q, mode: "insensitive" } } },
          { tenant: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 3,
      include: { tenant: { select: { firstName: true, lastName: true, companyName: true } } },
    });
    for (const inv of invoices) {
      const tenantName = inv.tenant.companyName ?? [inv.tenant.firstName, inv.tenant.lastName].filter(Boolean).join(" ");
      results.push({
        id: inv.id, type: "invoice",
        title: inv.invoiceNumber,
        subtitle: tenantName,
        href: `/facturation/${inv.id}`,
        meta: `${inv.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`,
      });
    }
  }

  // Contacts
  if (!typeFilter || typeFilter === "contact") {
    const contacts = await prisma.contact.findMany({
      where: {
        societyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      select: { id: true, name: true, email: true, company: true },
    });
    for (const c of contacts) {
      results.push({
        id: c.id, type: "contact",
        title: c.name, subtitle: c.company ?? c.email ?? undefined,
        href: `/contacts/${c.id}`,
      });
    }
  }

  return NextResponse.json({ data: results });
}
