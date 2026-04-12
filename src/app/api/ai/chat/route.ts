import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { chatWithAssistant, type ChatMessage, type ChatContext } from "@/lib/ai-chatbot";

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

    const body = (await req.json()) as { messages: ChatMessage[] };
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Messages requis" }, { status: 400 });
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

    const reply = await chatWithAssistant(body.messages, context);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[AI Chat]", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
