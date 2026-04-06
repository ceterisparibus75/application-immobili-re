import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Test geo.api.gouv.fr — résolution commune Rouen
  try {
    const geoRes = await fetch("https://geo.api.gouv.fr/communes?codePostal=76000&fields=nom,code,centre&limit=5", { signal: AbortSignal.timeout(10000) });
    const geoData = await geoRes.json();
    results.geoApi = { status: geoRes.status, data: geoData };
  } catch (e) {
    results.geoApi = { error: String(e) };
  }

  // Test multiple DVF API URL formats
  const dvfUrls = [
    { name: "etalab_v1", url: "https://app.dvf.etalab.gouv.fr/api/dvf?code_commune=76540" },
    { name: "etalab_v2", url: "https://api.dvf.etalab.gouv.fr/mutations?code_commune=76540" },
    { name: "etalab_v3", url: "https://apidf-preprod.cerema.fr/dvf/mutations/?code_insee=76540&page_size=5" },
    { name: "cerema_v1", url: "https://apidf-preprod.cerema.fr/dvf/geomutations/?in_bbox=1.04,49.39,1.14,49.49&page_size=5" },
    { name: "cerema_v2", url: "https://apidf-preprod.cerema.fr/indicateurs/dv3f/departements/76/communes/76540/mutations?page_size=5" },
    { name: "datagouv", url: "https://files.data.gouv.fr/geo-dvf/latest/csv/2023/departements/76.csv.gz" },
    { name: "geo_dvf", url: "https://api.cquest.org/dvf?code_commune=76540" },
    { name: "cquest_latlon", url: "https://api.cquest.org/dvf?lat=49.44&lon=1.09&dist=5000" },
  ];

  for (const { name, url } of dvfUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();
      results[name] = {
        status: res.status,
        contentType,
        bodyLength: text.length,
        bodyPreview: text.substring(0, 300),
      };
    } catch (e) {
      results[name] = { error: String(e) };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
