import { NextResponse } from "next/server";
import { getContactById } from "@/actions/contact";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const { societyId } = context;
  const contact = await getContactById(societyId, id);
  if (!contact) return NextResponse.json(null, { status: 404 });

  return NextResponse.json(contact);
}
