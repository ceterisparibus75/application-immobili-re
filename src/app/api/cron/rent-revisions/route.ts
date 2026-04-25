import { NextRequest, NextResponse } from "next/server";
import { detectPendingRevisions } from "@/actions/rent-revision";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const results = await detectPendingRevisions();

    if (results.errors.length > 0) {
      console.error(
        "[cron/rent-revisions]",
        `${results.created} révision(s) créée(s)`,
        `${results.errors.length} erreur(s)`,
        results.errors
      );
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("[cron/rent-revisions]", error);
    return NextResponse.json(
      { error: "Erreur lors de la détection des révisions" },
      { status: 500 }
    );
  }
}
