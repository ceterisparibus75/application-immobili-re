import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune société sélectionnée" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

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
      where: { id: societyId },
      select: { name: true },
    });

    const buildings = await prisma.building.findMany({
      where: { societyId },
      select: { name: true, city: true, postalCode: true },
      take: 10,
    });

    const context: ChatContext = {
      societyName: society?.name ?? "Société",
      userName: session.user.name ?? "Utilisateur",
      scope: {
        buildings: buildings.map((b) => ({
          name: b.name,
          address: `${b.city} ${b.postalCode}`,
          lotsCount: 0,
        })),
      },
    };

    const reply = await chatWithAssistant(parsed.data.messages, context);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[AI Chat]", error);
    return NextResponse.json({ error: "Erreur lors du traitement de la requête" }, { status: 500 });
  }
}
