import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type NavItem = {
  slug: string;
  title: string;
};

const ALL_GUIDES: NavItem[] = [
  { slug: "demarrage", title: "Démarrage rapide" },
  { slug: "utilisateurs", title: "Utilisateurs et droits d'accès" },
  { slug: "patrimoine", title: "Gestion du patrimoine" },
  { slug: "locatif", title: "Gestion locative" },
  { slug: "facturation", title: "Facturation et paiements" },
  { slug: "banque", title: "Banque et comptabilité" },
  { slug: "proprietaire", title: "Vue Propriétaire" },
  { slug: "emprunts", title: "Évaluations IA et emprunts" },
  { slug: "documents", title: "Documents, Dataroom et signatures" },
  { slug: "dashboard", title: "Tableau de bord et rapports" },
  { slug: "securite", title: "Sécurité et confidentialité" },
];

type Props = {
  slug: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function HelpPageLayout({ slug, icon, title, description, children }: Props) {
  const currentIndex = ALL_GUIDES.findIndex((g) => g.slug === slug);
  const prev = currentIndex > 0 ? ALL_GUIDES[currentIndex - 1] : null;
  const next = currentIndex < ALL_GUIDES.length - 1 ? ALL_GUIDES[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/aide" className="hover:text-foreground transition-colors">
            Centre d'aide
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{title}</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
          <p className="text-lg text-muted-foreground">{description}</p>
        </div>

        {/* Table des matières rapide */}
        <div className="border rounded-xl p-5 mb-10 bg-muted/30">
          <p className="text-sm font-semibold mb-3">Sur cette page</p>
          <div id="toc-container" />
        </div>

        {/* Contenu */}
        <div className="prose-custom space-y-12">
          {children}
        </div>

        {/* Navigation précédent / suivant */}
        <div className="flex items-center justify-between mt-16 pt-8 border-t">
          {prev ? (
            <Link href={`/aide/${prev.slug}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
              <ChevronLeft className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Précédent</p>
                <p className="font-medium">{prev.title}</p>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link href={`/aide/${next.slug}`} className="flex items-center gap-2 text-sm text-right hover:text-primary transition-colors">
              <div>
                <p className="text-xs text-muted-foreground">Suivant</p>
                <p className="font-medium">{next.title}</p>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div />
          )}
        </div>

        {/* Retour au centre d'aide */}
        <div className="text-center mt-8">
          <Link href="/aide" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            &larr; Retour au centre d'aide
          </Link>
        </div>
      </main>
    </div>
  );
}

type SectionProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

export function HelpSection({ id, title, children }: SectionProps) {
  return (
    <section id={id}>
      <h2 className="text-xl font-bold mb-4 pb-2 border-b">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

type StepProps = {
  number: number;
  title: string;
  children: React.ReactNode;
};

export function HelpStep({ number, title, children }: StepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="font-semibold text-foreground mb-1">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

type InfoBoxProps = {
  type: "info" | "tip" | "warning";
  children: React.ReactNode;
};

export function InfoBox({ type, children }: InfoBoxProps) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200",
    tip: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200",
  };
  const labels = { info: "Information", tip: "Astuce", warning: "Attention" };

  return (
    <div className={`rounded-lg border p-4 ${styles[type]}`}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1">{labels[type]}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
