import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function extractAndStoreFullText(documentId: string, storagePath: string): Promise<void> {
  try {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) return;

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const fullText = result.text?.trim().slice(0, 100_000) ?? null;

    if (fullText) {
      await prisma.document.update({ where: { id: documentId }, data: { fullText } });
    }
  } catch {
    // Silently ignore - full text is a best-effort enrichment
  }
}
