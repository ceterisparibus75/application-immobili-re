export function ProblemSection() {
  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Le constat</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
          Au-delà de quelques lots, les outils simples ne suffisent plus
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Les portefeuilles structurés finissent souvent avec un logiciel locatif, un tableur de trésorerie, un dossier documentaire, une comptabilité séparée et des rapports reconstruits à la main. Ce n'est pas un problème de saisie : c'est un problème de consolidation.
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
          Un référentiel unique pour gérer, contrôler et décider
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          MyGestia relie actifs, baux, locataires, factures, banque, comptabilité et documents autour de chaque société, puis consolide au niveau propriétaire. Vous gardez la granularité opérationnelle sans perdre la lecture patrimoniale.
        </p>
      </div>
    </section>
  );
}
