import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import JSZip from "jszip";

export async function GET(_req: NextRequest) {
  try {
    const session = await requirePortalAuth();

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    if (!tenant) return new NextResponse(null, { status: 404 });

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return new NextResponse(null, { status: 503 });

    const quittances = await prisma.invoice.findMany({
      where: { tenantId: tenant.id, invoiceType: "QUITTANCE", fileUrl: { not: null } },
      select: { invoiceNumber: true, fileUrl: true, issueDate: true },
      orderBy: { issueDate: "desc" },
      take: 60,
    });

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const zip = new JSZip();

    await Promise.all(
      quittances
        .filter((q) => q.fileUrl)
        .map(async (q) => {
          const { data, error } = await supabase.storage.from(bucket).download(q.fileUrl!);
          if (error || !data) return;
          const ab = await data.arrayBuffer();
          zip.file(`${q.invoiceNumber}.pdf`, ab);
        })
    );

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="quittances-${date}.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 401 });
  }
}
