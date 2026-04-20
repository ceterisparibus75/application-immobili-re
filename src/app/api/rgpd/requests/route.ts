import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { z } from "zod";

const createSchema = z.object({
  requesterName: z.string().min(1, "Le nom est requis"),
  requesterEmail: z.string().email("Email invalide"),
  requestType: z.enum(["access", "rectification", "deletion", "portability", "opposition"]),
  notes: z.string().optional().nullable(),
});

async function getSocietyContext() {
  const context = await requireActiveSocietyRouteContext();
  return context instanceof NextResponse ? null : context;
}

export async function GET() {
  const ctx = await getSocietyContext();
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const requests = await prisma.gdprRequest.findMany({
    where: { societyId: ctx.societyId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const ctx = await getSocietyContext();
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const request = await prisma.gdprRequest.create({
    data: {
      societyId: ctx.societyId,
      requesterName: parsed.data.requesterName,
      requesterEmail: parsed.data.requesterEmail,
      requestType: parsed.data.requestType,
      notes: parsed.data.notes ?? null,
      status: "pending",
    },
  });

  return NextResponse.json(request, { status: 201 });
}
