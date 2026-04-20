import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { getAuditLogs } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { AuditAction } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const societyId = searchParams.get("societyId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = Math.min(parseInt(searchParams.get("perPage") || "50", 10), 100);
    const action = searchParams.get("action") as AuditAction | null;
    const entity = searchParams.get("entity");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    if (!societyId) {
      return NextResponse.json({ error: "societyId requis" }, { status: 400 });
    }

    if (!/^c[a-z0-9]{24,}$/.test(societyId)) {
      return NextResponse.json({ error: "societyId invalide" }, { status: 400 });
    }

    const context = await requireActiveSocietyRouteContext({
      societyId,
      minRole: "ADMIN_SOCIETE",
    });
    if (context instanceof NextResponse) return context;

    const result = await getAuditLogs(societyId, {
      page,
      perPage,
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
      ...(userId ? { userId } : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
      ...(search ? { search } : {}),
    });

    // Also return distinct values for filter dropdowns
    const [entities, users] = await Promise.all([
      prisma.auditLog.findMany({
        where: { societyId },
        select: { entity: true },
        distinct: ["entity"],
        orderBy: { entity: "asc" },
      }),
      prisma.auditLog.findMany({
        where: { societyId, userId: { not: null } },
        select: { user: { select: { id: true, name: true, email: true } } },
        distinct: ["userId"],
      }),
    ]);

    return NextResponse.json({
      ...result,
      filterOptions: {
        entities: entities.map((e) => e.entity),
        users: users
          .filter((u) => u.user)
          .map((u) => ({ id: u.user!.id, label: u.user!.name || u.user!.email })),
      },
    });
  } catch (error) {
    console.error("[GET /api/audit]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
