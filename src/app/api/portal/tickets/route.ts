import { NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { createTicketFromPortal } from "@/actions/ticket";
import { createTicketSchema } from "@/validations/ticket";

// GET — Liste des tickets du locataire
export async function GET() {
  try {
    const session = await requirePortalAuth();

    // Recuperer tous les tenants associes a cet email
    const tenants = await prisma.tenant.findMany({
      where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });

    const tenantIds = tenants.map((t) => t.id);

    const tickets = await prisma.ticket.findMany({
      where: { tenantId: { in: tenantIds } },
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: tickets });
  } catch {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
}

// POST — Creer un ticket
export async function POST(request: Request) {
  try {
    const session = await requirePortalAuth();

    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    // Trouver le locataire et sa societe
    const tenant = await prisma.tenant.findFirst({
      where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true, societyId: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Locataire introuvable" }, { status: 404 });
    }

    const result = await createTicketFromPortal(tenant.id, tenant.societyId, parsed.data);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
}
