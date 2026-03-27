import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId)
    return NextResponse.json({ error: "Societe non selectionnee" }, { status: 400 });

  await requireSocietyAccess(session.user.id, societyId);

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ documents: [] });

  const documents = await prisma.document.findMany({
    where: {
      societyId,
      OR: [
        { fileName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { aiSummary: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      fileName: true,
      category: true,
      aiSummary: true,
      aiTags: true,
      aiStatus: true,
      createdAt: true,
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}
