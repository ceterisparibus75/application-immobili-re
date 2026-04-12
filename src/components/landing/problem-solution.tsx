export function ProblemSection() {
  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Le constat</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
          Un pilotage encore fragmenté
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Les portefeuilles immobiliers reposent souvent sur des systèmes disjoints : données locataires séparées de la comptabilité, absence de vision consolidée multi-sociétés, reporting construit manuellement. Cette fragmentation limite la capacité de pilotage et de contrôle.
        </p>
      </div>
    </section>
  );
}

export function SolutionSection() {
  return (
    <section className="py-24 sm:py-32 bg-[#F9FAFB] border-y border-border/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Notre approche</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
          Une infrastructure centrale de gestion et de contrôle
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          La plateforme constitue un système unique de consolidation et de pilotage du patrimoine immobilier. Elle structure l&apos;information autour de trois axes stratégiques : actifs, flux financiers et conformité opérationnelle.
        </p>
      </div>
    </section>
  );
}
