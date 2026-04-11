import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { Resend } from "resend";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  try {
    await requireSuperAdmin(session.user.id);
  } catch {
    return NextResponse.json({ error: "Accès réservé aux super administrateurs" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM ?? "(non configure)";

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      message: "RESEND_API_KEY manquant",
      emailFrom,
    });
  }

  const resend = new Resend(apiKey);

  // Verifier les domaines configures dans Resend
  const { data: domainsData, error: domainsError } = await resend.domains.list();

  if (domainsError || !domainsData) {
    return NextResponse.json({
      status: "error",
      message: "Impossible de recuperer les domaines: " + (domainsError?.message ?? "erreur inconnue"),
      emailFrom,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domains = (domainsData as any).data ?? domainsData ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedDomains = domains.map((d: any) => ({
    id: d.id,
    name: d.name,
    status: d.status, // verified | pending | not_started
    region: d.region,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records: (d.records ?? []).map((r: any) => ({
      type: r.type,
      name: r.name,
      value: r.value,
      status: r.status, // verified | not_started | pending
      ttl: r.ttl,
    })),
  }));

  // Domaine utilise pour l envoi
  const senderDomain = emailFrom.replace(/.*@/, "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const senderDomainSummary = formattedDomains.find((d: any) => d.name === senderDomain);

  // Recuperer le detail complet du domaine expediteur (inclut les records SPF/DKIM/DMARC)
  let senderDomainDetail = null;
  if (senderDomainSummary) {
    const { data: detail, error: detailError } = await resend.domains.get(senderDomainSummary.id);
    if (!detailError && detail) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = detail as any;
      senderDomainDetail = {
        id: d.id,
        name: d.name,
        status: d.status,
        region: d.region,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        records: (d.records ?? []).map((r: any) => ({
          record: r.record,   // MX, SPF, DKIM, DMARC
          name: r.name,
          type: r.type,
          ttl: r.ttl,
          status: r.status,   // verified | not_started | pending
          value: r.value,
        })),
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missingRecords = (senderDomainDetail?.records ?? []).filter((r: any) => r.status !== "verified");

  return NextResponse.json({
    status: "ok",
    emailFrom,
    senderDomain,
    senderDomainVerified: senderDomainSummary?.status === "verified",
    dnsComplete: missingRecords.length === 0,
    missingRecords,
    senderDomainDetail,
    allDomains: formattedDomains,
  });
}
// POST /api/admin/email-diagnostics
// Body: { action: 'delete_domain', domainId: string }
// Supprime un domaine Resend par son ID
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  try {
    await requireSuperAdmin(session.user.id);
  } catch {
    return NextResponse.json({ error: "Accès réservé aux super administrateurs" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "RESEND_API_KEY manquant" }, { status: 500 });

  const body = await request.json() as { action?: string; domainId?: string; to?: string };

  if (body.action === "delete_domain" && body.domainId) {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.domains.remove(body.domainId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, deleted: body.domainId, data });
  }

  // Action: cleanup - supprime automatiquement les domaines failed et not_started
  if (body.action === "cleanup") {
    const resend = new Resend(apiKey);
    const { data: domainsData, error: domainsError } = await resend.domains.list();
    if (domainsError || !domainsData)
      return NextResponse.json({ error: "Impossible de lister les domaines" }, { status: 500 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domains = (domainsData as any).data ?? domainsData ?? [];
    const emailFrom = process.env.EMAIL_FROM ?? "";
    const senderDomain = emailFrom.replace(/.*@/, "");

    const toDelete = domains.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d: any) => d.name !== senderDomain && ["failed", "not_started"].includes(d.status)
    );

    const results = [];
    for (const domain of toDelete) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await resend.domains.remove((domain as any).id);
      results.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        domain: (domain as any).name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: (domain as any).status,
        deleted: !error,
        error: error?.message,
      });
    }

    return NextResponse.json({ success: true, cleaned: results });
  }

  // Action: test_send - envoie un email simple sans piece jointe
  if (body.action === "test_send" && body.to) {
    const resend = new Resend(apiKey);
    const fromAddress = process.env.EMAIL_FROM ?? "noreply@mygestia.immo";
    const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Gestion Immobiliere";
    const { data, error } = await resend.emails.send({
      from: `"${appName}" <${fromAddress}>`,
      to: body.to as string,
      replyTo: fromAddress,
      subject: "[TEST] Verification de livraison email",
      html: `<p>Ceci est un email de test envoye depuis ${appName}.</p><p>Si vous recevez ce message, la configuration email fonctionne correctement.</p><p>Heure d envoi : ${new Date().toISOString()}</p>`,
    });
    if (error) return NextResponse.json({ success: false, error: error.message });
    return NextResponse.json({ success: true, emailId: data?.id, sentTo: body.to });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
