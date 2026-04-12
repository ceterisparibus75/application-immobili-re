import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { plans } from "./data";

export function Pricing() {
  return (
    <section id="tarifs" className="py-24 sm:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Offres</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Une tarification lisible et prévisible
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            14 jours d&apos;évaluation complète sur toutes les offres. Sans engagement, sans carte bancaire.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-8 flex flex-col bg-white transition-all duration-300 ${
                plan.highlighted
                  ? "border-[var(--color-brand-cyan)] shadow-brand-lg ring-2 ring-[var(--color-brand-cyan)]/30 relative md:-mt-4 md:mb-4"
                  : "border-border/60 shadow-brand hover:shadow-brand-lg"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-gradient-soft text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-brand">
                  Recommandé
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-[var(--color-brand-deep)]">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-[var(--color-brand-deep)]">{plan.price}</span>
                  <span className="text-xl font-semibold text-muted-foreground">&euro;/mois</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ou {plan.priceYearly}&euro;/an{" "}
                  <span className="text-[var(--color-brand-cyan)] font-semibold">
                    (-{Math.round((1 - plan.priceYearly / (plan.price * 12)) * 100)}%)
                  </span>
                </p>
              </div>

              <p className="text-xs font-semibold text-muted-foreground mb-5 pb-5 border-b border-border/60">
                {plan.limits}
              </p>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[var(--color-brand-cyan)] mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={plan.name === "Institutionnel" ? "/contact" : `/signup?plan=${plan.name.toLowerCase()}`} className="block">
                <Button
                  className={`w-full h-12 text-sm font-semibold rounded-lg ${
                    plan.highlighted
                      ? "bg-brand-gradient-soft hover:opacity-90 text-white shadow-brand"
                      : "border-[var(--color-brand-blue)]/20 text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-light)]"
                  }`}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.name === "Institutionnel"
                    ? "Contacter l\u2019équipe commerciale"
                    : "Démarrer l\u2019évaluation"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
