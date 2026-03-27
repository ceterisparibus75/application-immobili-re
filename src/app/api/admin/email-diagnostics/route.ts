import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Resend } from "resend";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });

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
  const senderDomainConfig = formattedDomains.find((d: any) => d.name === senderDomain);

  return NextResponse.json({
    status: "ok",
    emailFrom,
    senderDomain,
    senderDomainVerified: senderDomainConfig?.status === "verified",
    senderDomainConfig: senderDomainConfig ?? null,
    allDomains: formattedDomains,
  });
}