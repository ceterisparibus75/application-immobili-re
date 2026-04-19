import { NextResponse } from "next/server";
import { getChargeById } from "@/actions/charge";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const { societyId } = context;
  const charge = await getChargeById(societyId, id);
  if (!charge) return NextResponse.json(null, { status: 404 });

  return NextResponse.json(charge);
}
