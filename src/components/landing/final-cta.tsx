import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 bg-brand-gradient" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent)]" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5 text-white">
          Prêt à structurer votre gestion immobilière ?
        </h2>
        <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
          Évaluez MyGestia pendant 14 jours. Aucun engagement, aucune carte bancaire.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-white text-[var(--color-brand-deep)] hover:bg-white/90 font-bold rounded-lg shadow-xl"
            >
              Démarrer l&apos;évaluation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base px-8 h-13 bg-white/15 text-white hover:bg-white/25 font-bold border-2 border-white/30 rounded-lg"
            >
              Demander une présentation
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
