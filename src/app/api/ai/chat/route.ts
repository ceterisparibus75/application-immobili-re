import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { chatWithAssistant, type ChatContext } from "@/lib/ai-chatbot";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
});

export async function POST(req: NextRequest) {
  try {
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (routeContext instanceof NextResponse) return routeContext;

    const body = await req.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    // Build context
    const society = await prisma.society.findUnique({
      where: { id: routeContext.societyId },
      select: { name: true },
    });
    const user = await prisma.user.findUnique({
      where: { id: routeContext.userId },
      select: { name: true },
    });

    const buildings = await prisma.building.findMany({
      where: { societyId: routeContext.societyId },
      select: { name: true, city: true, postalCode: true },
      take: 10,
    });

    const chatContext: ChatContext = {
      societyName: society?.name ?? "Société",
      userName: user?.name ?? "Utilisateur",
      scope: {
        buildings: buildings.map((b) => ({
          name: b.name,
          address: `${b.city} ${b.postalCode}`,
          lotsCount: 0,
        })),
      },
    };

    const reply = await chatWithAssistant(parsed.data.messages, chatContext);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[AI Chat]", error);
    return NextResponse.json({ error: "Erreur lors du traitement de la requête" }, { status: 500 });
  }
}
