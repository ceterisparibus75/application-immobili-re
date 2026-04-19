import Link from "next/link";
import { Shield, ArrowRight, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stats } from "./data";

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-16">
      {/* Glow derrière le mockup */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_80%,rgba(27,79,138,0.12),transparent)] -z-10 blur-2xl scale-110" />

      <div className="rounded-xl border border-border/60 shadow-[0_32px_80px_rgba(27,79,138,0.15)] overflow-hidden bg-white ring-1 ring-black/5">
        {/* Barre titre navigateur */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#F9FAFB] border-b border-border/60">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-white border border-border/60 rounded-md h-6 flex items-center px-3 max-w-xs mx-auto">
              <span className="text-[10px] text-muted-foreground">app.mygestia.immo/dashboard</span>
            </div>
          </div>
        </div>

        {/* Interface app */}
        <div className="flex h-[340px] sm:h-[400px]">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col w-[52px] bg-[#1B4F8A] py-4 items-center gap-4">
            {["M", "P", "B", "F", "C"].map((l, i) => (
              <div
                key={l}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-default ${
                  i === 0 ? "bg-white/20 text-white" : "text-white/50"
                }`}
              >
                {l}
              </div>
            ))}
          </div>

          {/* Contenu principal */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#F9FAFB]">
            {/* Header interne */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-border/60">
              <div>
                <p className="text-xs text-muted-foreground">Tableau de bord</p>
                <p className="text-sm font-semibold text-[var(--color-brand-deep)]">SCI Dupont & Associés</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-brand-gradient-soft text-white flex items-center justify-center text-[10px] font-bold">
                  MD
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 py-4">
              {[
                { label: "Loyers du mois", value: "18 420 €", delta: "+2,1%", positive: true },
                { label: "Taux d'occupation", value: "94,1 %", delta: "+1,5pt", positive: true },
                { label: "Encours impayés", value: "1 240 €", delta: "-38%", positive: true },
                { label: "Lots actifs", value: "34 / 36", delta: "", positive: true },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-sm sm:text-base font-bold text-[var(--color-brand-deep)] mt-0.5">{kpi.value}</p>
                  {kpi.delta && (
                    <p className="text-[10px] font-medium text-[var(--color-status-positive)] mt-0.5 flex items-center gap-0.5">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {kpi.delta}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Table baux */}
            <div className="flex-1 px-4 sm:px-6 pb-4 overflow-hidden">
              <div className="bg-white rounded-lg border border-border/60 overflow-hidden h-full">
                <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[var(--color-brand-deep)]">Baux actifs</p>
                  <span className="text-[10px] text-[var(--color-brand-cyan)] font-medium">Voir tout →</span>
                </div>
                <div className="divide-y divide-border/40">
                  {[
                    { lot: "Apt. 4B — Rue de Rivoli", tenant: "M. Lefebvre", rent: "1 250 €", status: "À jour", ok: true },
                    { lot: "Local 1 — Av. Kléber", tenant: "Société ABC", rent: "3 200 €", status: "À jour", ok: true },
                    { lot: "Apt. 2A — Bd Haussmann", tenant: "Mme Moreau", rent: "890 €", status: "Relance J+5", ok: false },
                    { lot: "Apt. 7C — Rue du Bac", tenant: "M. & Mme Petit", rent: "1 550 €", status: "À jour", ok: true },
                  ].map((row) => (
                    <div key={row.lot} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[10px] items-center hover:bg-[#F9FAFB]">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-brand-deep)] truncate">{row.lot}</p>
                        <p className="text-muted-foreground truncate">{row.tenant}</p>
                      </div>
                      <p className="font-semibold text-[var(--color-brand-deep)] tabular-nums">{row.rent}</p>
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${
                        row.ok
                          ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]"
                          : "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]"
                      }`}>
                        {row.ok ? <CheckCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(27,79,138,0.08),transparent)]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-brand-cyan)]/[0.04] rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full mb-8 ring-1 ring-[var(--color-brand-cyan)]/20">
            <Shield className="h-4 w-4" />
            Plateforme sécurisée de gestion d&apos;actifs immobiliers
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-[var(--color-brand-deep)]">
            La maîtrise de votre
            <br />
            <span className="text-brand-gradient">patrimoine immobilier.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Plateforme unifiée pour la consolidation, l&apos;analyse et la sécurisation des actifs immobiliers. Conçue pour les environnements multi-entités exigeants.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
            <Link href="/contact">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg shadow-brand-lg">
                Demander une démonstration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#fonctionnalites">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-13 rounded-lg border-[var(--color-brand-blue)]/20 text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-light)]">
                Découvrir la plateforme
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Déploiement accompagné pour les multipropriétaires
          </p>
        </div>

        {/* Mockup dashboard */}
        <DashboardMockup />

        {/* Stats */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-white border border-border/60 rounded-xl p-8 shadow-brand">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-brand-gradient">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
