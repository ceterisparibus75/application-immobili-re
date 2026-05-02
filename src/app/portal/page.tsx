import { getPortalSession } from "@/lib/portal-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Receipt,
  Shield,
  MessageSquare,
  ArrowRight,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const metadata = { title: "Espace locataire" };

const features = [
  {
    icon: FileText,
    title: "Vos documents",
    desc: "Bail, avenants, états des lieux et attestations réunis en un seul endroit.",
  },
  {
    icon: Receipt,
    title: "Quittances de loyer",
    desc: "Téléchargez vos quittances en PDF ou en archive ZIP pour vos démarches.",
  },
  {
    icon: Shield,
    title: "Attestation d'assurance",
    desc: "Envoyez votre attestation directement à votre gestionnaire en quelques secondes.",
  },
  {
    icon: MessageSquare,
    title: "Demandes & tickets",
    desc: "Signalez un problème, posez une question, suivez vos demandes en temps réel.",
  },
];

const steps = [
  { icon: Mail, label: "Saisissez votre adresse email" },
  { icon: KeyRound, label: "Copiez le code reçu par email" },
  { icon: CheckCircle2, label: "Accédez à votre espace" },
];

export default async function PortalLandingPage() {
  const session = await getPortalSession();
  if (session) redirect("/portal/dashboard");

  return (
    <div className="w-full max-w-xl">
      {/* Hero */}
      <Card className="mb-4">
        <CardContent className="pt-7 pb-6 text-center">
          <h1 className="text-2xl font-bold mb-2 text-foreground">
            Votre espace locataire
          </h1>
          <p className="text-sm text-muted-foreground mb-7 max-w-sm mx-auto leading-relaxed">
            Accédez à vos documents, téléchargez vos quittances et échangez
            avec votre gestionnaire — sans mot de passe, en toute simplicité.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 mb-7 text-left">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
              >
                <f.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold leading-snug">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button asChild size="lg" className="w-full">
            <Link href="/portal/login">
              Accéder à mon espace
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>

          {/* Trust badge */}
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-3">
            <Lock className="h-3 w-3" />
            Connexion par code email — pas de mot de passe à retenir
          </p>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="mb-4 border-dashed">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 text-center">
            Comment se connecter
          </p>
          <ol className="flex items-start justify-between gap-2">
            {steps.map((s, i) => (
              <li key={i} className="flex-1 flex flex-col items-center text-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <s.icon className="h-4 w-4" />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{s.label}</p>
                {i < steps.length - 1 && (
                  <div className="absolute hidden" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Activate link */}
      <p className="text-center text-xs text-muted-foreground">
        Première visite ?{" "}
        <Link href="/portal/activate" className="text-primary hover:underline font-medium">
          Activez votre compte
        </Link>
        {" "}&middot;{" "}
        <span className="text-muted-foreground/60">{APP_NAME} &copy; {new Date().getFullYear()}</span>
      </p>
    </div>
  );
}
