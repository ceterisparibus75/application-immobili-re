import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { z } from "zod";

export async function GET() {
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json([], { status: 401 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  try {
    await requireSocietyAccess(session.user.id, societyId);
  } catch {
    return NextResponse.json([], { status: 403 });
  }

  const accounts = await prisma.accountingAccount.findMany({
    where: { societyId },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(accounts);
}

const createSchema = z.object({
  code: z.string().min(1).regex(/^\d+$/),
  label: z.string().min(1),
  type: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const existing = await prisma.accountingAccount.findFirst({
    where: { societyId, code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Le compte ${parsed.data.code} existe déjà` },
      { status: 409 }
    );
  }

  const account = await prisma.accountingAccount.create({
    data: { societyId, ...parsed.data },
  });

  return NextResponse.json(account, { status: 201 });
}
