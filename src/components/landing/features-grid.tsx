import { features } from "./data";

export function FeaturesGrid() {
  return (
    <section id="fonctionnalites" className="py-24 sm:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Plateforme</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Capacités clés
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Une infrastructure complète pour structurer, piloter et sécuriser la gestion de votre patrimoine immobilier.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-border/60 bg-white p-8 shadow-brand hover:shadow-brand-lg hover:border-[var(--color-brand-cyan)]/30 transition-all duration-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gradient-soft text-white mb-5 group-hover:scale-105 transition-transform duration-300">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
