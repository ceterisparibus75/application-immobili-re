import { caseStudies } from "./data";

export function CaseStudies() {
  return (
    <section id="etudes-de-cas" className="py-24 sm:py-32 bg-white border-t border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Études de cas</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Retours d&apos;expérience clients
          </h2>
          <p className="text-lg text-muted-foreground">
            Des résultats mesurables, obtenus par des professionnels exigeants.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {caseStudies.map((cs) => (
            <div
              key={cs.title}
              className="rounded-xl border border-border/60 bg-[#F9FAFB] p-8 shadow-brand hover:shadow-brand-lg transition-shadow flex flex-col"
            >
              <div className="inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] mb-4 self-start">
                {cs.sector}
              </div>
              <h3 className="text-base font-bold text-[var(--color-brand-deep)] mb-4 leading-snug">{cs.title}</h3>
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Enjeu</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cs.challenge}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Solution</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cs.solution}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Résultat</p>
                  <p className="text-sm font-medium text-[var(--color-brand-deep)] leading-relaxed">{cs.result}</p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-border/60">
                <p className="text-xs text-muted-foreground">{cs.author}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
