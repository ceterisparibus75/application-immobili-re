import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePortalAuth();
    const { id } = await params;

    // Use the specific tenantId from the JWT session — never search across all societies
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    if (!tenant) return new NextResponse(null, { status: 404 });

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: tenant.id },
      select: { fileUrl: true, invoiceNumber: true },
    });

    if (!invoice?.fileUrl) {
      return new NextResponse(null, { status: 404 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return new NextResponse(null, { status: 503 });

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    const { data: blob, error } = await supabase.storage.from(bucket).download(invoice.fileUrl);
    if (error || !blob) return new NextResponse(null, { status: 404 });

    const ab = await blob.arrayBuffer();
    return new NextResponse(ab, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="FACTURE-${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 401 });
  }
}
