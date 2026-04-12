import { faqs } from "./data";

export function FAQ() {
  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
            Questions fréquentes
          </h2>
        </div>
        <div className="space-y-0">
          {faqs.map((faq) => (
            <div key={faq.q} className="border-b border-border/60 last:border-b-0 py-6">
              <h3 className="font-semibold text-[var(--color-brand-deep)] mb-2 text-base">{faq.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
