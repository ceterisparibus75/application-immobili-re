import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifie" } }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: { code: "NO_SOCIETY", message: "Aucune societe selectionnee" } }, { status: 401 });
    }

    await requireSocietyAccess(session.user.id, societyId);

    const { searchParams } = new URL(request.url);
    const leaseType = searchParams.get("leaseType");

    const templates = await prisma.leaseTemplate.findMany({
      where: {
        societyId,
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
