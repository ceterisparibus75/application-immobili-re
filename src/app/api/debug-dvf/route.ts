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

  // 2. Test Etalab DVF
  try {
    const etalabRes = await fetch("https://app.dvf.etalab.gouv.fr/api/mutations?code_commune=76540", { signal: AbortSignal.timeout(15000) });
    const contentType = etalabRes.headers.get("content-type");
    const text = await etalabRes.text();
    results.etalab = {
      status: etalabRes.status,
      contentType,
      bodyPreview: text.substring(0, 500),
      bodyLength: text.length,
    };
  } catch (e) {
    results.etalab = { error: String(e) };
  }

  // 3. Test CEREMA — bbox autour de Rouen (49.44, 1.09)
  try {
    const ceremaUrl = "https://apidf-preprod.cerema.fr/dvf/geomutations/?in_bbox=1.04,49.39,1.14,49.49&date_mutation_min=2023-01-01&nature_mutation=Vente&page_size=5";
    const ceremaRes = await fetch(ceremaUrl, { signal: AbortSignal.timeout(15000) });
    const contentType = ceremaRes.headers.get("content-type");
    const text = await ceremaRes.text();
    results.cerema = {
      status: ceremaRes.status,
      contentType,
      bodyPreview: text.substring(0, 500),
      bodyLength: text.length,
    };
  } catch (e) {
    results.cerema = { error: String(e) };
  }

  // 4. Test cquest — lat/lon Rouen
  try {
    const cquestRes = await fetch("https://api.cquest.org/dvf?lat=49.44&lon=1.09&dist=5000", { signal: AbortSignal.timeout(15000) });
    const contentType = cquestRes.headers.get("content-type");
    const text = await cquestRes.text();
    results.cquest = {
      status: cquestRes.status,
      contentType,
      bodyPreview: text.substring(0, 500),
      bodyLength: text.length,
    };
  } catch (e) {
    results.cquest = { error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
