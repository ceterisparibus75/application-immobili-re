type Revision = {
  effectiveDate: Date | string;
};

type RentStep = {
  startDate: Date | string;
  amount: number;
};

type LeaseTimelineBarProps = {
  startDate: Date | string;
  endDate: Date | string;
  rentRevisions?: Revision[];
  rentSteps?: RentStep[];
  now: number;
};

function toMs(d: Date | string): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pct(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function LeaseTimelineBar({
  startDate,
  endDate,
  rentRevisions = [],
  rentSteps = [],
  now,
}: LeaseTimelineBarProps) {
  const start = toMs(startDate);
  const end = toMs(endDate);

  const todayPct = pct(now, start, end);
  const isActive = now >= start && now <= end;
  const isExpired = now > end;

  const daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.round((now - start) / (1000 * 60 * 60 * 24));

  // Dédupliquer les révisions + paliers par position (évite le chevauchement visuel)
  const revisionPcts = rentRevisions
    .map((r) => pct(toMs(r.effectiveDate), start, end))
    .filter((p) => p > 2 && p < 98);

  const stepPcts = rentSteps
    .filter((s) => toMs(s.startDate) > start) // Exclure le palier initial
    .map((s) => ({
      pct: pct(toMs(s.startDate), start, end),
      amount: s.amount,
    }))
    .filter((s) => s.pct > 2 && s.pct < 98);

  return (
    <div
      className="rounded-xl p-4 shadow-brand bg-white"
      aria-label="Progression du bail"
    >
      {/* Label + statut */}
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: "var(--color-brand-blue)" }}
        >
          Progression du bail
        </p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={
            isExpired
              ? {
                  background: "var(--color-status-negative-bg)",
                  color: "var(--color-status-negative)",
                }
              : daysRemaining <= 90
                ? {
                    background: "var(--color-status-caution-bg)",
                    color: "var(--color-status-caution)",
                  }
                : {
                    background: "var(--color-status-positive-bg)",
                    color: "var(--color-status-positive)",
                  }
          }
        >
          {isExpired
            ? "Expiré"
            : daysRemaining <= 90
              ? `${daysRemaining}j restants`
              : isActive
                ? `${elapsedDays} / ${totalDays}j`
                : "Pas encore commencé"}
        </span>
      </div>

      {/* Barre de progression */}
      <div className="relative h-10 flex items-center">
        {/* Piste */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-gray-100" />

        {/* Remplissage jusqu'à aujourd'hui */}
        {(isActive || isExpired) && (
          <div
            className="absolute left-0 h-2 rounded-full bg-brand-gradient-soft"
            style={{ width: `${Math.min(100, todayPct)}%` }}
          />
        )}

        {/* Marqueurs de révision */}
        {revisionPcts.map((p, i) => (
          <div
            key={`rev-${i}`}
            className="absolute w-2 h-2 rounded-full border-2 border-white z-10"
            style={{
              left: `${p}%`,
              transform: "translateX(-50%)",
              background: "var(--color-status-caution)",
            }}
            title={`Révision n°${i + 1}`}
          />
        ))}

        {/* Marqueurs de paliers de loyer */}
        {stepPcts.map((s, i) => (
          <div
            key={`step-${i}`}
            className="absolute w-2.5 h-2.5 rounded-sm border-2 border-white z-10 rotate-45"
            style={{
              left: `${s.pct}%`,
              transform: "translateX(-50%) rotate(45deg)",
              background: "var(--color-brand-cyan)",
            }}
            title={`Palier ${i + 1} : ${s.amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
          />
        ))}

        {/* Marqueur aujourd'hui */}
        {isActive && (
          <div
            className="absolute z-20 flex flex-col items-center"
            style={{ left: `${todayPct}%`, transform: "translateX(-50%)" }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
              style={{ background: "var(--color-brand-blue)" }}
            />
          </div>
        )}
      </div>

      {/* Dates + légende */}
      <div className="flex items-end justify-between mt-1">
        <div className="text-left">
          <p className="text-[10px] text-muted-foreground">Début</p>
          <p className="text-[11px] font-medium tabular-nums text-[var(--color-brand-deep)]">
            {fmtDate(startDate)}
          </p>
        </div>

        {/* Légende marqueurs */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {revisionPcts.length > 0 && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: "var(--color-status-caution)" }}
              />
              Révision
            </span>
          )}
          {stepPcts.length > 0 && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-sm rotate-45"
                style={{ background: "var(--color-brand-cyan)" }}
              />
              Palier
            </span>
          )}
          {isActive && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: "var(--color-brand-blue)" }}
              />
              Auj.
            </span>
          )}
        </div>

        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Fin</p>
          <p className="text-[11px] font-medium tabular-nums text-[var(--color-brand-deep)]">
            {fmtDate(endDate)}
          </p>
        </div>
      </div>
    </div>
  );
}
