import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { steps } from "./data";

export function HowItWorks() {
  return (
    <section className="py-24 sm:py-32 bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Déploiement</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Opérationnel en 3 étapes
          </h2>
          <p className="text-lg text-muted-foreground">
            Un déploiement progressif et structuré, adapté à la complexité de votre patrimoine.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((item, i) => (
            <div key={item.step} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-[var(--color-brand-cyan)]/30" />
              )}
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-xl bg-brand-gradient text-white text-3xl font-bold mb-6 shadow-brand-lg">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link href="/signup">
            <Button size="lg" className="gap-2 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg shadow-brand-lg">
              Démarrer l&apos;évaluation <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
