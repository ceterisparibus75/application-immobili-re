import { BadgeCheck, Lock, Globe, FileText, Clock } from "lucide-react";

export function SocialProof() {
  return (
    <section className="border-y border-border/60 bg-white py-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-muted-foreground font-medium">
          <span className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-[var(--color-brand-cyan)]" /> Conformité RGPD
          </span>
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--color-brand-blue)]" /> Chiffrement AES-256-GCM
          </span>
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--color-brand-cyan)]" /> Hébergement souverain UE
          </span>
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--color-brand-blue)]" /> Export FEC conforme
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--color-brand-cyan)]" /> SLA 99,9%
          </span>
        </div>
      </div>
    </section>
  );
}
