import Link from "next/link";
import { Landmark, Users, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const solutionCards = [
  {
    icon: Landmark,
    title: "Pour les Foncières & Family Offices",
    description: "Pilotez le rendement de vos actifs avec une vision consolidée, multi-sociétés et multi-structures juridiques.",
    items: [
      "Vision consolidée du patrimoine et de la trésorerie",
      "Rendement brut, LTV et taux d'occupation en temps réel",
      "Reporting propriétaire multi-sociétés",
      "Copropriété et location saisonnière intégrées",
      "Assistant IA : prédiction des impayés et génération de courriers",
      "Gestion des emprunts et de l'amortissement",
    ],
  },
  {
    icon: Users,
    title: "Pour les Professionnels de la Gestion",
    description: "Automatisez vos flux opérationnels et structurez la relation locataire avec rigueur et traçabilité.",
    items: [
      "Facturation et quittancement automatisés",
      "Workflows & automatisations personnalisables",
      "CRM & gestion des candidatures locataires",
      "Portail locataire sécurisé avec documents",
      "Comptabilité intégrée et export FEC conforme",
      "Rapprochement bancaire et suivi de trésorerie",
    ],
  },
];

export function Solutions() {
  return (
    <section id="solutions" className="py-24 sm:py-32 bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Solutions</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Une réponse adaptée à chaque métier
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Que vous pilotiez un patrimoine familial ou gériez pour compte de tiers, MyGestia s&apos;adapte à vos exigences opérationnelles.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {solutionCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border/60 bg-white p-8 shadow-brand hover:shadow-brand-lg transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gradient-soft text-white mb-6">
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-brand-deep)] mb-2">{card.title}</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{card.description}</p>
              <ul className="space-y-3">
                {card.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[var(--color-brand-cyan)] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/signup">
                  <Button className="w-full bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg">
                    Évaluer la solution <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
