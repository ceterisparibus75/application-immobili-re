import Link from "next/link";
import { CheckCircle2, ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export const metadata = {
  title: "Message envoyé — MyGestia",
  description: "Votre message a bien été reçu. Notre équipe vous répondra sous 24h ouvrées.",
};

export default function ContactMerciPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">
          Message bien reçu !
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-2">
          Merci pour votre intérêt pour MyGestia. Notre équipe étudiera votre demande et vous répondra
          sous <strong className="text-foreground">24h ouvrées</strong>.
        </p>
        <p className="text-sm text-muted-foreground mb-10">
          En attendant, vous pouvez démarrer votre essai gratuit de 14 jours sans carte bancaire.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup">
            <Button className="w-full sm:w-auto h-11 rounded-xl font-semibold gap-2 bg-brand-gradient-soft hover:opacity-90 text-white">
              <Calendar className="h-4 w-4" />
              Démarrer l'essai gratuit
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full sm:w-auto h-11 rounded-xl font-semibold gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
