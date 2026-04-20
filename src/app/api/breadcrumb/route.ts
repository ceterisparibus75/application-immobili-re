import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";

/**
 * Résout les noms d'entités pour les segments d'ID dans un pathname.
 * GET /api/breadcrumb?path=/patrimoine/immeubles/abc123/lots/def456
 * → { "2": "12 rue de la Paix", "4": "Lot 3 - Bureau RDC" }
 */
export async function GET(request: NextRequest) {
  const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
  if (context instanceof NextResponse) {
    return NextResponse.json({}, { status: context.status });
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

    const label = await resolveEntityName(parentSegment, segment, context.societyId);
    if (label) labels[String(i)] = label;
  }

  return NextResponse.json(labels, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}

async function resolveEntityName(
  parentSegment: string,
  id: string,
  societyId: string,
): Promise<string | null> {
  try {
    switch (parentSegment) {
      case "immeubles": {
        const b = await prisma.building.findFirst({
          where: { id, societyId },
          select: { name: true, addressLine1: true },
        });
        return b ? (b.name || b.addressLine1 || null) : null;
      }
      case "lots": {
        const l = await prisma.lot.findFirst({
          where: { id, building: { societyId } },
          select: { number: true, description: true },
        });
        return l ? (l.description || `Lot ${l.number}`) : null;
      }
      case "baux": {
        const lease = await prisma.lease.findFirst({
          where: { id, societyId },
          select: { lot: { select: { number: true, description: true } }, tenant: { select: { firstName: true, lastName: true } } },
        });
        if (!lease) return null;
        const tenantName = [lease.tenant?.firstName, lease.tenant?.lastName].filter(Boolean).join(" ");
        return tenantName ? `Bail — ${tenantName}` : (lease.lot?.description || `Lot ${lease.lot?.number}` || null);
      }
      case "locataires": {
        const t = await prisma.tenant.findFirst({
          where: { id, societyId },
          select: { firstName: true, lastName: true, companyName: true },
        });
        if (!t) return null;
        return t.companyName || [t.firstName, t.lastName].filter(Boolean).join(" ") || null;
      }
      case "facturation": {
        const inv = await prisma.invoice.findFirst({
          where: { id, societyId },
          select: { invoiceNumber: true },
        });
        return inv ? (inv.invoiceNumber ? `Facture ${inv.invoiceNumber}` : null) : null;
      }
      case "banque": {
        const ba = await prisma.bankAccount.findFirst({
          where: { id, societyId },
          select: { accountName: true, bankName: true },
        });
        return ba ? (ba.accountName || ba.bankName || null) : null;
      }
      case "emprunts": {
        const loan = await prisma.loan.findFirst({
          where: { id, societyId },
          select: { label: true },
        });
        return loan?.label ?? null;
      }
      case "contacts": {
        const c = await prisma.contact.findFirst({
          where: { id, societyId },
          select: { name: true },
        });
        return c?.name ?? null;
      }
      case "charges": {
        const ch = await prisma.charge.findFirst({
          where: { id, societyId },
          select: { description: true },
        });
        return ch?.description ?? null;
      }
      case "utilisateurs": {
        const membership = await prisma.userSociety.findFirst({
          where: { userId: id, societyId },
          select: {
            user: {
              select: { name: true, firstName: true, lastName: true },
            },
          },
        });
        const u = membership?.user;
        if (!u) return null;
        return u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
      }
      case "diagnostics": {
        const d = await prisma.diagnostic.findFirst({
          where: { id, building: { societyId } },
          select: { type: true },
        });
        return d?.type ?? null;
      }
      case "societes": {
        if (id !== societyId) return null;
        const s = await prisma.society.findFirst({
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
