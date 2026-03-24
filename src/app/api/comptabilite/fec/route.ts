import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { generateFec } from "@/lib/fec-export";
import { createAuditLog } from "@/lib/audit";
import { ForbiddenError } from "@/lib/permissions";

// GET — Telechargement du fichier FEC
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId)
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch (e) {
    if (e instanceof ForbiddenError)
      return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const yearStr = p.get("year");
  const journalStr = p.get("journal");

  const options: Parameters<typeof generateFec>[1] = {};
  if (yearStr) {
    const y = parseInt(yearStr, 10);
    if (!isNaN(y) && y >= 2000 && y <= 2100) options.year = y;
  }
  if (
    journalStr &&
    ["VENTES", "BANQUE", "OPERATIONS_DIVERSES"].includes(journalStr)
  ) {
    options.journalType = journalStr as "VENTES" | "BANQUE" | "OPERATIONS_DIVERSES";
  }
  if (p.get("validatedOnly") === "true") options.validatedOnly = true;

  const result = await generateFec(societyId, options);

  await createAuditLog({
    societyId,
    userId: session.user.id,
    action: "EXPORT",
    entity: "JournalEntry",
    entityId: societyId,
    details: { format: "FEC", year: yearStr, lineCount: result.lineCount },
  });

  return new NextResponse(result.content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}

// POST — Validation sans telechargement
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId)
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch (e) {
    if (e instanceof ForbiddenError)
      return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { year, journalType, validatedOnly } = body as Record<string, unknown>;

  const result = await generateFec(societyId, {
    year: typeof year === "string" ? parseInt(year, 10) : undefined,
    journalType: typeof journalType === "string"
      ? (journalType as "VENTES" | "BANQUE" | "OPERATIONS_DIVERSES")
      : undefined,
    validatedOnly: validatedOnly === true,
  });

  return NextResponse.json({
    lineCount: result.lineCount,
    anomalies: result.anomalies,
    stats: result.stats,
    filename: result.filename,
  });
}
