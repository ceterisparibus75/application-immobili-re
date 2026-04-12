import Link from "next/link";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stats } from "./data";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(27,79,138,0.08),transparent)]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-brand-cyan)]/[0.04] rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full mb-8 ring-1 ring-[var(--color-brand-cyan)]/20">
            <Shield className="h-4 w-4" />
            Plateforme sécurisée de gestion d&apos;actifs immobiliers
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-[var(--color-brand-deep)]">
            La maîtrise de votre
            <br />
            <span className="text-brand-gradient">patrimoine immobilier.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Plateforme unifiée pour la consolidation, l&apos;analyse et la sécurisation des actifs immobiliers. Conçue pour les environnements multi-entités exigeants.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
            <Link href="/contact">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg shadow-brand-lg">
                Demander une démonstration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#fonctionnalites">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-13 rounded-lg border-[var(--color-brand-blue)]/20 text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-light)]">
                Découvrir la plateforme
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Déploiement accompagné pour les multipropriétaires
          </p>
        </div>

        <div className="mt-20 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-white border border-border/60 rounded-xl p-8 shadow-brand">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-brand-gradient">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
