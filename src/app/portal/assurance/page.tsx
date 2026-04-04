import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, FileText, ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { InsuranceUploadForm } from "./insurance-upload-form";

export default async function PortalAssurancePage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  // Trouver TOUS les locataires avec cet email (multi-société)
  const tenants = await prisma.tenant.findMany({
    where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
    select: {
      id: true,
      insuranceFileUrl: true,
      insuranceUploadedAt: true,
      insuranceExpiresAt: true,
      society: { select: { name: true } },
    },
  });

  if (tenants.length === 0) redirect("/portal/login");

  // Vérifier si au moins un locataire a une assurance
  const hasInsurance = tenants.some((t) => !!t.insuranceUploadedAt);
  // Prendre le premier qui a une assurance pour afficher les infos
  const tenantWithInsurance = tenants.find((t) => !!t.insuranceUploadedAt);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attestation d&apos;assurance</h1>
        <p className="text-muted-foreground">
          Déposez votre attestation d&apos;assurance en cours de validité
        </p>
      </div>

      {hasInsurance && tenantWithInsurance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Attestation actuelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="success">Déposée</Badge>
              <span className="text-sm text-muted-foreground">
                le {formatDate(tenantWithInsurance.insuranceUploadedAt!)}
              </span>
            </div>
            {tenantWithInsurance.insuranceExpiresAt && (
              <p className="text-sm text-muted-foreground">
                Expire le {formatDate(tenantWithInsurance.insuranceExpiresAt)}
              </p>
            )}
            {tenantWithInsurance.insuranceFileUrl && (
              <a
                href={tenantWithInsurance.insuranceFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Voir le document
              </a>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {hasInsurance ? "Mettre à jour l\u2019attestation" : "Déposer une attestation"}
          </CardTitle>
          <CardDescription>
            Fichier PDF uniquement, 10 Mo maximum
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InsuranceUploadForm />
        </CardContent>
      </Card>
    </div>
  );
}
