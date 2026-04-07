import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";

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

  // P0 security: verify the user actually belongs to this society
  try {
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const results: SearchResult[] = [];

  // Run all queries in parallel for performance
  const [buildings, lots, tenants, leases, invoices, contacts] = await Promise.all([
    // Immeubles
    prisma.building.findMany({
      where: {
        societyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { addressLine1: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, addressLine1: true, city: true },
    }),
    // Lots
    prisma.lot.findMany({
      where: {
        building: { societyId },
        OR: [
          { number: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { building: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 5,
      include: { building: { select: { name: true } } },
    }),
    // Locataires
    prisma.tenant.findMany({
      where: {
        societyId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    // Baux
    prisma.lease.findMany({
      where: {
        societyId,
        OR: [
          { tenant: { firstName: { contains: q, mode: "insensitive" } } },
          { tenant: { lastName: { contains: q, mode: "insensitive" } } },
          { tenant: { companyName: { contains: q, mode: "insensitive" } } },
          { lot: { number: { contains: q, mode: "insensitive" } } },
          { lot: { building: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      take: 5,
      include: {
        tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
        lot: { select: { number: true, building: { select: { name: true } } } },
      },
    }),
    // Factures
    prisma.invoice.findMany({
      where: {
        societyId,
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { tenant: { firstName: { contains: q, mode: "insensitive" } } },
          { tenant: { lastName: { contains: q, mode: "insensitive" } } },
          { tenant: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 5,
      include: { tenant: { select: { firstName: true, lastName: true, companyName: true } } },
    }),
    // Contacts
    prisma.contact.findMany({
      where: {
        societyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true, company: true },
    }),
  ]);

  buildings.forEach((b) => results.push({
    id: b.id, type: "building",
    title: b.name, subtitle: [b.addressLine1, b.city].filter(Boolean).join(", "),
    href: `/patrimoine/immeubles/${b.id}`,
  }));

  lots.forEach((l) => results.push({
    id: l.id, type: "lot",
    title: l.number ?? l.id,
    subtitle: l.building.name,
    href: `/patrimoine/immeubles/${l.buildingId}/lots/${l.id}`,
  }));

  tenants.forEach((t) => results.push({
    id: t.id, type: "tenant",
    title: t.entityType === "PERSONNE_MORALE"
      ? (t.companyName ?? t.id)
      : [t.firstName, t.lastName].filter(Boolean).join(" "),
    subtitle: t.email ?? undefined,
    href: `/locataires/${t.id}`,
  }));

  leases.forEach((l) => {
    const tenantName = l.tenant.companyName
      ?? [l.tenant.firstName, l.tenant.lastName].filter(Boolean).join(" ");
    results.push({
      id: l.id, type: "lease",
      title: `${tenantName} — ${l.lot.number}`,
      subtitle: l.lot.building.name,
      href: `/baux/${l.id}`,
    });
  });

  invoices.forEach((inv) => {
    const tenantName = inv.tenant.companyName ?? [inv.tenant.firstName, inv.tenant.lastName].filter(Boolean).join(" ");
    results.push({
      id: inv.id, type: "invoice",
      title: inv.invoiceNumber,
      subtitle: tenantName,
      href: `/facturation/${inv.id}`,
      meta: `${inv.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`,
    });
  });

  contacts.forEach((c) => results.push({
    id: c.id, type: "contact",
    title: c.name, subtitle: c.company ?? c.email ?? undefined,
    href: `/contacts/${c.id}`,
  }));

  return NextResponse.json({ data: results });
}
