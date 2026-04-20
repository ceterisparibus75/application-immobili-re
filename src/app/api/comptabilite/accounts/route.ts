import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { z } from "zod";

export async function GET() {
  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const accounts = await prisma.accountingAccount.findMany({
    where: { societyId: context.societyId },
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
  const context = await requireActiveSocietyRouteContext({ minRole: "COMPTABLE" });
  if (context instanceof NextResponse) return context;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const existing = await prisma.accountingAccount.findFirst({
    where: { societyId: context.societyId, code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Le compte ${parsed.data.code} existe déjà` },
      { status: 409 }
    );
  }

  const account = await prisma.accountingAccount.create({
    data: { societyId: context.societyId, ...parsed.data },
  });

  return NextResponse.json(account, { status: 201 });
}
