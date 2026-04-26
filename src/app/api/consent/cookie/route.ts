import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  visitorId: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const { decision, visitorId } = parsed.data;
    const isGranted = decision === "accepted";

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? null;
    const userAgent = request.headers.get("user-agent") ?? null;

    // Utiliser le visitorId comme identifiant anonyme (pas d'email réel)
    const email = visitorId
      ? `visitor-${visitorId.replace(/[^a-zA-Z0-9-]/g, "")}@cookie.consent`
      : `anonymous@cookie.consent`;

    await prisma.consent.create({
      data: {
        email,
        purpose: "analytics_cookies",
        isGranted,
        ipAddress,
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[consent/cookie] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
