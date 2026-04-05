import { NextResponse } from "next/server";

/**
 * GET /api/public/siret?q=12345678901234
 * Recherche d'entreprise via l'API publique recherche-entreprises.api.gouv.fr
 * Pas de clé API requise — gratuit et ouvert.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json(
      { error: "Paramètre 'q' requis (min 3 caractères)" },
      { status: 400 }
    );
  }

  try {
    // L'API recherche-entreprises accepte SIRET, SIREN, ou nom
    const apiUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&page=1&per_page=15`;
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // Cache 1h
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Erreur lors de la recherche" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const results = (data.results ?? []).map((r: Record<string, unknown>) => {
      const siege = r.siege as Record<string, unknown> | undefined;
      const siret = siege?.siret as string | undefined;
      const nom = (r.nom_complet ?? r.nom_raison_sociale ?? "") as string;
      const natureJuridique = (r.nature_juridique ?? "") as string;
      const adresse = siege
        ? `${siege.numero_voie ?? ""} ${siege.type_voie ?? ""} ${siege.libelle_voie ?? ""}`.trim()
        : "";
      const codePostal = (siege?.code_postal ?? "") as string;
      const ville = (siege?.libelle_commune ?? "") as string;

      // Mapper la nature juridique vers nos LegalForm
      let legalForm = "AUTRE";
      const nj = natureJuridique.toLowerCase();
      if (nj.includes("sci") || natureJuridique === "6540") legalForm = "SCI";
      else if (nj.includes("sarl") || natureJuridique === "5720") legalForm = "SARL";
      else if (nj.includes("sas") && !nj.includes("sasu")) legalForm = "SAS";
      else if (nj.includes("sasu") || natureJuridique === "5710") legalForm = "SASU";
      else if (nj.includes("eurl") || natureJuridique === "5498") legalForm = "EURL";
      else if (nj.includes("sa ") || natureJuridique === "5599") legalForm = "SA";
      else if (nj.includes("snc")) legalForm = "SNC";

      // Extraire le dirigeant principal (personne physique ou morale)
      const dirigeants = (r.dirigeants ?? []) as Array<Record<string, unknown>>;
      let representantLegal = "";
      if (dirigeants.length > 0) {
        const d = dirigeants[0];
        if (d.nom) {
          // Personne physique : "M. DUPONT Jean, Gérant"
          const prenoms = (d.prenoms ?? "") as string;
          const nom_d = (d.nom ?? "") as string;
          const qualite = (d.qualite ?? "") as string;
          representantLegal = `${prenoms} ${nom_d}`.trim();
          if (qualite) representantLegal += `, ${qualite}`;
        } else if (d.denomination) {
          // Personne morale
          const denomination = (d.denomination ?? "") as string;
          const qualite = (d.qualite ?? "") as string;
          representantLegal = denomination;
          if (qualite) representantLegal += `, ${qualite}`;
        }
      }

      return {
        siret: siret ?? "",
        siren: (r.siren ?? "") as string,
        name: nom,
        legalForm,
        natureJuridique,
        addressLine1: adresse,
        postalCode: codePostal,
        city: ville,
        tvaNumber: (r.numero_tva_intra ?? "") as string,
        representantLegal,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[SIRET API]", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la recherche" },
      { status: 500 }
    );
  }
}
