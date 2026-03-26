import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

import { cookies } from "next/headers";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

// Map common column names to fields

function detectColumns(headers: string[]): { codeIdx: number; labelIdx: number; typeIdx: number } {

  const h = headers.map(h => h?.toString().toLowerCase().trim() ?? "");

  const codeIdx = h.findIndex(c =>

    c.includes("numéro") || c.includes("numero") || c.includes("n°") ||

    c.includes("code") || c.includes("compte") || c === "n" || c === "no"

  );

  const labelIdx = h.findIndex(c =>

    c.includes("libellé") || c.includes("libelle") || c.includes("intitulé") ||

    c.includes("intitule") || c.includes("label") || c.includes("désignation") ||

    c.includes("designation") || c.includes("nom")

  );

  const typeIdx = h.findIndex(c =>

    c.includes("classe") || c.includes("type") || c.includes("catégorie") ||

    c.includes("categorie") || c.includes("racine")

  );

  return { codeIdx: codeIdx >= 0 ? codeIdx : 0, labelIdx: labelIdx >= 0 ? labelIdx : 1, typeIdx };

}

function inferClass(code: string): string {

  const first = code.trim().charAt(0);

  if (first >= "1" && first <= "7") return first;

  return "6";

}

export async function POST(req: NextRequest) {

  const session = await auth();

  if (!session?.user?.id) {

    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  }

  const cookieStore = await cookies();

  const societyId = cookieStore.get("active-society-id")?.value;

  if (!societyId) {

    return NextResponse.json({ error: "Société non sélectionnée" }, { status: 400 });

  }

  let formData: FormData;

  try {

    formData = await req.formData();

  } catch {

    return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });

  }

  const file = formData.get("file") as File | null;

  if (!file) {

    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });

  }

  const filename = file.name.toLowerCase();

  const buffer = Buffer.from(await file.arrayBuffer());

  // ─── Excel / CSV ─────────────────────────────────────────────────────────────

  if (filename.endsWith(".xlsx") || filename.endsWith(".xls") || filename.endsWith(".ods")) {

    try {

      const ExcelJS = (await import("exceljs")).default;

      const workbook = new ExcelJS.Workbook();

      if (filename.endsWith(".xlsx") || filename.endsWith(".ods")) {

        await workbook.xlsx.load(buffer as unknown as import("exceljs").Buffer);

      } else {

        await workbook.xlsx.load(buffer as unknown as import("exceljs").Buffer);

      }

      const worksheet = workbook.worksheets[0];

      if (!worksheet) {

        return NextResponse.json({ error: "Feuille de calcul vide ou introuvable" }, { status: 422 });

      }

      const rows: string[][] = [];

      worksheet.eachRow((row, _rowNumber) => {

        const cells = (row.values as (string | number | null | undefined)[])

          .slice(1) // exceljs row.values starts at index 1

          .map(v => v?.toString().trim() ?? "");

        rows.push(cells);

      });

      if (rows.length < 2) {

        return NextResponse.json({ error: "Le fichier est vide ou ne contient qu'une ligne d'en-tête" }, { status: 422 });

      }

      const { codeIdx, labelIdx, typeIdx } = detectColumns(rows[0]);

      const accounts = rows.slice(1)

        .filter(r => r[codeIdx] && r[labelIdx])

        .map(r => {

          const code = r[codeIdx].replace(/\s/g, "").replace(/[^0-9A-Za-z]/g, "").slice(0, 10);

          const label = r[labelIdx].slice(0, 255);

          const rawType = typeIdx >= 0 ? r[typeIdx] : "";

          const type = rawType ? rawType.trim().charAt(0) : inferClass(code);

          return { code, label, type: (type >= "1" && type <= "7") ? type : inferClass(code) };

        })

        .filter(a => a.code.length >= 2 && a.label.length >= 1);

      return NextResponse.json({ accounts, source: "excel", total: accounts.length });

    } catch (err) {

      console.error("[import-plan/excel]", err);

      return NextResponse.json({ error: "Impossible de lire le fichier Excel. Vérifiez qu'il est au format .xlsx ou .xls" }, { status: 422 });

    }

  }

  // ─── PDF via Claude AI ────────────────────────────────────────────────────────

  if (filename.endsWith(".pdf")) {

    if (!env.ANTHROPIC_API_KEY) {

      return NextResponse.json({

        error: "L'analyse de PDF nécessite la clé API Anthropic (ANTHROPIC_API_KEY). Configurez-la dans vos variables d'environnement ou utilisez un fichier Excel.",

      }, { status: 503 });

    }

    try {

      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

      const base64 = buffer.toString("base64");

      const message = await client.messages.create({

        model: "claude-opus-4-6",

        max_tokens: 4096,

        messages: [

          {

            role: "user",

            content: [

              {

                type: "document",

                source: { type: "base64", media_type: "application/pdf", data: base64 },

              },

              {

                type: "text",

                text: "Analyse ce document qui est un plan comptable. Extrait tous les comptes comptables présents.\nPour chaque compte, retourne un objet JSON avec :\n- code: numéro de compte (string, ex: \"411000\")\n- label: intitulé du compte (string)\n- type: premier chiffre du numéro de compte (string \"1\" à \"7\")\n\nRéponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après, sans markdown, sans backticks.\nFormat attendu: [{\"code\":\"101000\",\"label\":\"Capital social\",\"type\":\"1\"}, ...]\nSi aucun compte n'est trouvé, réponds avec un tableau vide: []",

              },

            ],

          },

        ],

      });

      const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

      let raw: { code: string; label: string; type?: string }[] = [];

      try {

        raw = JSON.parse(text);

      } catch {

        // Try to extract JSON array from text

        const match = text.match(/\[[\s\S]*\]/);

        if (match) raw = JSON.parse(match[0]);

        else return NextResponse.json({ error: "L'IA n'a pas pu extraire les comptes du PDF. Essayez avec un fichier Excel." }, { status: 422 });

      }

      const accounts = raw

        .filter(a => a.code && a.label)

        .map(a => ({

          code: a.code.replace(/\s/g, "").slice(0, 10),

          label: a.label.slice(0, 255),

          type: a.type ?? inferClass(a.code),

        }));

      return NextResponse.json({ accounts, source: "pdf-ai", total: accounts.length });

    } catch (err) {

      console.error("[import-plan/pdf]", err);

      return NextResponse.json({ error: "Erreur lors de l'analyse IA du PDF. Réessayez ou utilisez un fichier Excel." }, { status: 500 });

    }

  }

  return NextResponse.json({

    error: "Format non supporté. Utilisez un fichier Excel (.xlsx, .xls) ou PDF.",

  }, { status: 415 });

}
