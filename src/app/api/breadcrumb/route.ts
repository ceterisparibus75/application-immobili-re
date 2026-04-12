import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Résout les noms d'entités pour les segments d'ID dans un pathname.
 * GET /api/breadcrumb?path=/patrimoine/immeubles/abc123/lots/def456
 * → { "2": "12 rue de la Paix", "4": "Lot 3 - Bureau RDC" }
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({}, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("path");
  if (!pathname) return NextResponse.json({});

  const segments = pathname.split("/").filter(Boolean);
  const labels: Record<string, string> = {};

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!/^[a-z0-9]{20,}$/.test(segment)) continue;

    const parentSegment = segments[i - 1];
    if (!parentSegment) continue;

    const label = await resolveEntityName(parentSegment, segment);
    if (label) labels[String(i)] = label;
  }

  return NextResponse.json(labels, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}

async function resolveEntityName(
  parentSegment: string,
  id: string,
): Promise<string | null> {
  try {
    switch (parentSegment) {
      case "immeubles": {
        const b = await prisma.building.findUnique({
          where: { id },
          select: { name: true, address: true },
        });
        return b ? (b.name || b.address || null) : null;
      }
      case "lots": {
        const l = await prisma.lot.findUnique({
          where: { id },
          select: { label: true },
        });
        return l?.label ?? null;
      }
      case "baux": {
        const lease = await prisma.lease.findUnique({
          where: { id },
          select: { lot: { select: { label: true } }, tenant: { select: { firstName: true, lastName: true } } },
        });
        if (!lease) return null;
        const tenantName = [lease.tenant?.firstName, lease.tenant?.lastName].filter(Boolean).join(" ");
        return tenantName ? `Bail — ${tenantName}` : (lease.lot?.label ?? null);
      }
      case "locataires": {
        const t = await prisma.tenant.findUnique({
          where: { id },
          select: { firstName: true, lastName: true, companyName: true },
        });
        if (!t) return null;
        return t.companyName || [t.firstName, t.lastName].filter(Boolean).join(" ") || null;
      }
      case "facturation": {
        const inv = await prisma.invoice.findUnique({
          where: { id },
          select: { label: true, number: true },
        });
        return inv ? (inv.number ? `Facture ${inv.number}` : inv.label) : null;
      }
      case "banque": {
        const ba = await prisma.bankAccount.findUnique({
          where: { id },
          select: { label: true },
        });
        return ba?.label ?? null;
      }
      case "emprunts": {
        const loan = await prisma.loan.findUnique({
          where: { id },
          select: { label: true },
        });
        return loan?.label ?? null;
      }
      case "contacts": {
        const c = await prisma.contact.findUnique({
          where: { id },
          select: { name: true },
        });
        return c?.name ?? null;
      }
      case "charges": {
        const ch = await prisma.charge.findUnique({
          where: { id },
          select: { label: true },
        });
        return ch?.label ?? null;
      }
      case "utilisateurs": {
        const u = await prisma.user.findUnique({
          where: { id },
          select: { name: true, firstName: true, lastName: true },
        });
        if (!u) return null;
        return u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
      }
      case "diagnostics": {
        const d = await prisma.diagnostic.findUnique({
          where: { id },
          select: { type: true },
        });
        return d?.type ?? null;
      }
      case "societes": {
        const s = await prisma.society.findUnique({
          where: { id },
          select: { name: true },
        });
        return s?.name ?? null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
