import { highlights } from "./data";

export function HighlightsBanner() {
  return (
    <section className="py-16 bg-white border-y border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {highlights.map((h) => (
            <div key={h.title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient text-white flex-shrink-0">
                <h.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-brand-deep)] mb-1">{h.title}</h3>
                <p className="text-sm text-muted-foreground">{h.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
