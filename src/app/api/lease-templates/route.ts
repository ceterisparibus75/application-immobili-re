import { NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const context = await requireActiveSocietyRouteContext();
    if (context instanceof NextResponse) return context;

    const { searchParams } = new URL(request.url);
    const leaseType = searchParams.get("leaseType");

    const templates = await prisma.leaseTemplate.findMany({
      where: {
        societyId: context.societyId,
        isActive: true,
        ...(leaseType ? { leaseType: leaseType as import("@/generated/prisma/client").LeaseType } : {}),
      },
      select: {
        id: true,
        name: true,
        leaseType: true,
        isDefault: true,
        defaultDurationMonths: true,
        defaultPaymentFrequency: true,
        defaultBillingTerm: true,
        defaultVatApplicable: true,
        defaultVatRate: true,
        defaultIndexType: true,
        defaultDepositMonths: true,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: templates });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL", message: "Erreur serveur" } }, { status: 500 });
  }
}
