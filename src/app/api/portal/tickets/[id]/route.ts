import { NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

// GET — Detail du ticket avec messages
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePortalAuth();
    const { id } = await params;

    // Trouver les tenants de cet email
    const tenants = await prisma.tenant.findMany({
      where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    const tenantIds = tenants.map((t) => t.id);

    const ticket = await prisma.ticket.findFirst({
      where: { id, tenantId: { in: tenantIds } },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
    }

    // Marquer les messages du gestionnaire comme lus
    await prisma.ticketMessage.updateMany({
      where: { ticketId: id, authorType: "MANAGER", isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ data: ticket });
  } catch {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
}
