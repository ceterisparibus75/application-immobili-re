import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

export async function GET() {
  const context = await requireActiveSocietyRouteContext();

  if (context instanceof NextResponse) {
    if (context.status !== 400) return context;

    return NextResponse.json({
      data: {
        hasActiveSociety: false,
        memberCount: 0,
        buildingCount: 0,
        tenantCount: 0,
        leaseCount: 0,
        bankAccountCount: 0,
      },
    });
  }

  const { societyId } = context;

  const [memberCount, buildingCount, tenantCount, leaseCount, bankAccountCount] =
    await Promise.all([
      prisma.userSociety.count({ where: { societyId } }),
      prisma.building.count({ where: { societyId } }),
      prisma.tenant.count({ where: { societyId, isActive: true } }),
      prisma.lease.count({ where: { societyId } }),
      prisma.bankAccount.count({ where: { societyId } }),
    ]);

  return NextResponse.json({
    data: {
      hasActiveSociety: true,
      memberCount,
      buildingCount,
      tenantCount,
      leaseCount,
      bankAccountCount,
    },
  });
}
