import { Check, Minus, X } from "lucide-react";

type Status = "yes" | "partial" | "no";

interface CompRow {
  feature: string;
  mygestia: Status;
  excel: Status;
  generic: Status;
  note?: string;
}

const rows: CompRow[] = [
  { feature: "Gestion multi-sociétés consolidée", mygestia: "yes", excel: "no", generic: "partial" },
  { feature: "Facturation automatique & quittances PDF", mygestia: "yes", excel: "no", generic: "yes" },
  { feature: "Comptabilité intégrée & export FEC", mygestia: "yes", excel: "partial", generic: "no" },
  { feature: "Rapprochement bancaire automatique", mygestia: "yes", excel: "no", generic: "partial" },
  { feature: "Révisions IRL/ILC/ILAT automatiques (INSEE)", mygestia: "yes", excel: "no", generic: "partial" },
  { feature: "Portail locataire sécurisé", mygestia: "yes", excel: "no", generic: "partial" },
  { feature: "Assistant IA & prédiction des impayés", mygestia: "yes", excel: "no", generic: "no" },
  { feature: "Signature électronique intégrée", mygestia: "yes", excel: "no", generic: "no" },
  { feature: "Conformité RGPD native + audit logs", mygestia: "yes", excel: "no", generic: "partial" },
  { feature: "Chiffrement AES-256 des données bancaires", mygestia: "yes", excel: "no", generic: "no" },
  { feature: "Copropriété & location saisonnière", mygestia: "yes", excel: "no", generic: "no" },
];

function StatusIcon({ status }: { status: Status }) {
  if (status === "yes")
    return (
      <div className="flex justify-center">
        <div className="h-6 w-6 rounded-full bg-[var(--color-status-positive-bg)] flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-[var(--color-status-positive)] stroke-[2.5]" />
        </div>
      </div>
    );
  if (status === "partial")
    return (
      <div className="flex justify-center">
        <div className="h-6 w-6 rounded-full bg-[var(--color-status-caution-bg)] flex items-center justify-center">
          <Minus className="h-3.5 w-3.5 text-[var(--color-status-caution)] stroke-[2.5]" />
        </div>
      </div>
    );
  return (
    <div className="flex justify-center">
      <div className="h-6 w-6 rounded-full bg-[#FEF2F2] flex items-center justify-center">
        <X className="h-3.5 w-3.5 text-[#EF4444] stroke-[2.5]" />
      </div>
    </div>
  );
}

export function Comparison() {
  return (
    <section id="comparaison" className="py-24 sm:py-32 bg-[#F9FAFB] border-t border-border/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Comparaison</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Pourquoi MyGestia ?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Un outil métier complet, là où les solutions généralistes s&apos;arrêtent à mi-chemin.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/60 bg-white shadow-brand">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left px-6 py-4 text-[var(--color-brand-deep)] font-semibold w-1/2">
                  Fonctionnalité
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-white bg-brand-gradient-soft px-3 py-1 rounded-full">
                      MyGestia
                    </span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <span className="text-xs font-semibold text-muted-foreground">Tableur Excel</span>
                </th>
                <th className="px-4 py-4 text-center">
                  <span className="text-xs font-semibold text-muted-foreground">Logiciel généraliste</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-border/40 last:border-0 transition-colors hover:bg-[#F9FAFB] ${
                    i % 2 === 0 ? "" : "bg-[#FAFBFC]"
                  }`}
                >
                  <td className="px-6 py-3.5 text-[var(--color-brand-deep)] font-medium">{row.feature}</td>
                  <td className="px-4 py-3.5">
                    <StatusIcon status={row.mygestia} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusIcon status={row.excel} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusIcon status={row.generic} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-center gap-6 mt-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-[var(--color-status-positive-bg)] flex items-center justify-center">
              <Check className="h-2.5 w-2.5 text-[var(--color-status-positive)]" />
            </div>
            Inclus nativement
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-[var(--color-status-caution-bg)] flex items-center justify-center">
              <Minus className="h-2.5 w-2.5 text-[var(--color-status-caution)]" />
            </div>
            Partiel ou plugin tiers
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <X className="h-2.5 w-2.5 text-[#EF4444]" />
            </div>
            Non disponible
          </span>
        </div>
      </div>
    </section>
  );
}
