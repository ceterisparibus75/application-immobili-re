export interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: "Réglementation" | "Gestion" | "Fiscalité" | "Technologie";
}

export const articles: Article[] = [
  {
    slug: "gerer-fonciere-multi-immeubles",
    title: "Comment gérer efficacement une foncière multi-immeubles",
    description:
      "Structuration du patrimoine, consolidation financière, pilotage par société : les clés pour administrer un portefeuille immobilier complexe sans perte de contrôle.",
    date: "2026-03-15",
    readTime: "8 min",
    category: "Gestion",
  },
  {
    slug: "rgpd-gestion-immobiliere",
    title: "RGPD et gestion immobilière : obligations et bonnes pratiques",
    description:
      "Durées de conservation, consentement locataire, chiffrement des données bancaires : panorama complet des exigences RGPD appliquées à la gestion locative.",
    date: "2026-02-28",
    readTime: "10 min",
    category: "Réglementation",
  },
  {
    slug: "comptabilite-immobiliere-fec-tva",
    title: "Comptabilité immobilière : FEC, TVA et obligations fiscales",
    description:
      "Plan comptable immobilier, export FEC conforme, régime TVA des loyers commerciaux : maîtrisez les obligations comptables et fiscales de votre foncière.",
    date: "2026-02-10",
    readTime: "9 min",
    category: "Fiscalité",
  },
  {
    slug: "digitalisation-gestion-locative-2026",
    title: "Digitalisation de la gestion locative : guide complet 2026",
    description:
      "Automatisation de la facturation, rapprochement bancaire, portail locataire : comment la transformation numérique optimise la gestion immobilière professionnelle.",
    date: "2026-01-22",
    readTime: "7 min",
    category: "Technologie",
  },
  {
    slug: "indices-irl-ilc-ilat-revisions-loyer",
    title: "Indices IRL, ILC, ILAT : comprendre les révisions de loyer",
    description:
      "Fonctionnement des indices INSEE, calendrier de publication, formule de calcul et automatisation des révisions : tout ce qu'il faut savoir pour rester conforme.",
    date: "2026-01-05",
    readTime: "8 min",
    category: "Réglementation",
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

const categoryColors: Record<Article["category"], string> = {
  Réglementation: "bg-amber-100 text-amber-800",
  Gestion: "bg-blue-100 text-blue-800",
  Fiscalité: "bg-emerald-100 text-emerald-800",
  Technologie: "bg-violet-100 text-violet-800",
};

export function getCategoryColor(category: Article["category"]): string {
  return categoryColors[category];
}
