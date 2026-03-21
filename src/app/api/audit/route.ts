import { auth } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit";
import { requireSocietyAccess } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const societyId = searchParams.get("societyId");
    const page = parseInt(searchParams.get("page") || "1", 10);

    if (!societyId) {
      return NextResponse.json(
        { error: "societyId requis" },
        { status: 400 }
      );
    }

    // Validate CUID format to prevent malformed inputs
    if (!/^c[a-z0-9]{24,}$/.test(societyId)) {
      return NextResponse.json(
        { error: "societyId invalide" },
        { status: 400 }
      );
    }

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const result = await getAuditLogs(societyId, { page, perPage: 50 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/audit]", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
