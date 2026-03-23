import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse(null, { status: 400 });

  // Sécurité : empêcher la traversée de répertoires
  const cleanPath = path.replace(/\.\.\//g, "").replace(/^\//, "");

  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
    .createSignedUrl(cleanPath, 3600);

  if (error || !data?.signedUrl) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
