import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const features = [
  "Baux, révisions de loyer et quittances automatisées",
  "Comptabilité générale et export FEC DGFiP",
  "Portail locataire avec code OTP intégré",
  "Multi-sociétés : SCI, SARL de famille, holding",
  "Reporting consolidé et état des impayés",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: "linear-gradient(145deg, #F0F9FF 0%, #F9FAFB 100%)" }}
    >
      {/* Panneau gauche — visible lg+ uniquement */}
      <div
        className="hidden lg:flex lg:w-[460px] xl:w-[520px] shrink-0 flex-col justify-between p-12"
        style={{
          background: "linear-gradient(160deg, #0C2340 0%, #1B4F8A 65%, #1a6fa8 100%)",
        }}
      >
        {/* Logo */}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mygestia.svg"
            alt="MyGestia"
            className="h-9 brightness-0 invert"
            width={140}
            height={36}
          />
          <p className="text-sm text-white/50 mt-2">Gestion locative intelligente</p>
        </div>

        {/* Pitch */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            Pilotez votre patrimoine immobilier
          </h1>
          <p className="text-white/70 text-sm leading-relaxed mb-8">
            La plateforme tout-en-un pour les gestionnaires de SCI, holdings
            patrimoniales et foncières privées.
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-white/80">
                <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pied de page */}
        <div className="space-y-1">
          <p className="text-xs text-white/40">
            Essai gratuit 14 jours &middot; Sans carte bancaire
          </p>
          <Link
            href="/portal"
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Accès espace locataire &rarr;
          </Link>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex flex-1 items-center justify-center p-4 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile uniquement */}
          <div className="flex flex-col items-center gap-3 mb-8 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mygestia.svg"
              alt="MyGestia"
              className="h-10"
              width={156}
              height={40}
            />
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestion locative intelligente
            </p>
          </div>

          {/* Carte avec verre givré */}
          <div
            className="w-full rounded-xl border border-border/40 shadow-brand-lg p-8"
            style={{
              background: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(40px) saturate(200%)",
              WebkitBackdropFilter: "blur(40px) saturate(200%)",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
