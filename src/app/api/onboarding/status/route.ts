import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;

  if (!societyId) {
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

  const [memberCount, buildingCount, tenantCount, leaseCount, bankAccountCount] =
    await Promise.all([
      prisma.userSociety.count({ where: { societyId } }),
      prisma.building.count({ where: { societyId } }),
      prisma.tenant.count({ where: { societyId, isArchived: false } }),
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
