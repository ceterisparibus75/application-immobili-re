import { getPortalSession } from "@/lib/portal-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Receipt, Shield, MessageSquare, ArrowRight } from "lucide-react";

export const metadata = { title: "Espace locataire" };

const features = [
  { icon: FileText, title: "Documents", desc: "Bail, états des lieux, attestations" },
  { icon: Receipt, title: "Quittances", desc: "Téléchargez toutes vos quittances" },
  { icon: Shield, title: "Assurance", desc: "Déposez et suivez vos attestations" },
  { icon: MessageSquare, title: "Demandes", desc: "Contactez directement votre bailleur" },
];

export default async function PortalLandingPage() {
  const session = await getPortalSession();
  if (session) redirect("/portal/dashboard");

  return (
    <div className="w-full max-w-xl">
      <Card className="mb-6">
        <CardContent className="pt-6 pb-5 text-center">
          <h1 className="text-xl font-semibold mb-2">Votre espace locataire</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Accédez à vos documents, quittances et communiquez avec votre bailleur en un seul endroit.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                <f.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Button asChild className="w-full">
            <Link href="/portal/login">
              Se connecter à mon espace
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Première visite ?{" "}
        <Link href="/portal/activate" className="text-primary hover:underline">
          Activez votre compte
        </Link>
      </p>
    </div>
  );
}
