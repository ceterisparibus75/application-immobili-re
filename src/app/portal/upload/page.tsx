import { requirePortalAuth } from "@/lib/portal-auth";
import { redirect } from "next/navigation";
import { DocumentUpload } from "@/components/portal/document-upload";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Shield, FileText } from "lucide-react";

export default async function PortalUploadPage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-brand-deep)]">
          Envoyer un document
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Déposez vos documents pour les transmettre à votre gestionnaire
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Assurance */}
        <Card className="shadow-brand">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-violet-500" />
              Attestation d&apos;assurance
            </CardTitle>
            <CardDescription>
              Déposez votre attestation d&apos;assurance habitation en cours de validité
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUpload
              endpoint="/api/portal/upload-insurance"
              accept=".pdf"
              maxSizeMB={10}
              label="Déposer l'attestation"
              description="Format PDF uniquement — max 10 Mo"
            />
          </CardContent>
        </Card>

        {/* Document général */}
        <Card className="shadow-brand">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-blue-500" />
              Document général
            </CardTitle>
            <CardDescription>
              Envoyez tout autre document à votre gestionnaire (justificatif, courrier, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUpload
              endpoint="/api/portal/upload-document"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSizeMB={10}
              enableAI
              label="Déposer un document"
              description="PDF, JPG ou PNG — max 10 Mo — analyse IA automatique"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
