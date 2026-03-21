import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getContactById } from "@/actions/contact";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json(null, { status: 401 });

  const contact = await getContactById(societyId, id);
  if (!contact) return NextResponse.json(null, { status: 404 });

  return NextResponse.json(contact);
}
