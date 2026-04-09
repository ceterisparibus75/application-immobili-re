import { NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { addTicketMessageFromPortal } from "@/actions/ticket";

// POST — Ajouter un message au ticket
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePortalAuth();
    const { id: ticketId } = await params;

    const body = await request.json();
    const { content } = body as { content: string };

    if (!content?.trim()) {
      return NextResponse.json({ error: "Le message est requis" }, { status: 400 });
    }

    // Trouver le locataire
    const tenant = await prisma.tenant.findFirst({
      where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Locataire introuvable" }, { status: 404 });
    }

    const result = await addTicketMessageFromPortal(tenant.id, {
      ticketId,
      content: content.trim(),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
}
