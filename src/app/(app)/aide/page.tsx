import { Building2, BookOpen, Mail, Shield, FileText, Users, BarChart3, Banknote, HelpCircle, Layers, TrendingUp, FolderLock, UserCog, ChevronRight, CreditCard, Phone, RefreshCw, Contact } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Centre d'aide | ${APP_NAME}`,
  description: "Guides, FAQ et support pour la gestion de votre patrimoine immobilier",
};

const guides = [
  {
    slug: "demarrage",
    icon: <Building2 className="h-6 w-6" />,
    title: "Démarrage rapide",
    description: "Créez votre société, ajoutez vos immeubles et commencez à gérer en quelques minutes.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    slug: "utilisateurs",
    icon: <UserCog className="h-6 w-6" />,
    title: "Utilisateurs et droits d'accès",
    description: "Gérez les utilisateurs, les rôles et les permissions par société et par module.",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    slug: "patrimoine",
    icon: <Building2 className="h-6 w-6" />,
    title: "Gestion du patrimoine",
    description: "Immeubles, lots, diagnostics, maintenances et états des lieux.",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    slug: "locatif",
    icon: <Users className="h-6 w-6" />,
    title: "Gestion locative",
    description: "Baux, locataires, révisions de loyer, charges et contacts.",
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    slug: "facturation",
    icon: <FileText className="h-6 w-6" />,
    title: "Facturation et paiements",
    description: "Factures, paiements, relances automatiques, SEPA et quittances.",
    color: "bg-rose-500/10 text-rose-600",
  },
  {
    slug: "banque",
    icon: <Banknote className="h-6 w-6" />,
    title: "Banque et comptabilité",
    description: "Comptes bancaires, rapprochement, écritures comptables et export FEC.",
    color: "bg-cyan-500/10 text-cyan-600",
  },
  {
    slug: "proprietaire",
    icon: <Layers className="h-6 w-6" />,
    title: "Vue Propriétaire",
    description: "Tableau de bord consolidé multi-sociétés et gestion des propriétaires.",
    color: "bg-indigo-500/10 text-indigo-600",
  },
  {
    slug: "emprunts",
    icon: <TrendingUp className="h-6 w-6" />,
    title: "Évaluations IA et emprunts",
    description: "Estimation du patrimoine par IA, emprunts et tableaux d'amortissement.",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    slug: "documents",
    icon: <FolderLock className="h-6 w-6" />,
    title: "Documents, Dataroom et signatures",
    description: "Stockage sécurisé, partage de documents et signatures électroniques.",
    color: "bg-teal-500/10 text-teal-600",
  },
  {
    slug: "dashboard",
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Tableau de bord et rapports",
    description: "KPI en temps réel, graphiques interactifs et rapports exportables.",
    color: "bg-pink-500/10 text-pink-600",
  },
  {
    slug: "securite",
    icon: <Shield className="h-6 w-6" />,
    title: "Sécurité et confidentialité",
    description: "Protection des données, RGPD, 2FA et portail locataire.",
    color: "bg-slate-500/10 text-slate-600",
  },
];

const faqs = [
  {
    q: "Comment ajouter un nouvel utilisateur à ma société ?",
    a: "Allez dans Mon compte > Utilisateurs > Créer un utilisateur. Renseignez son nom, prénom et email, puis sélectionnez la ou les sociétés auxquelles il aura accès avec un rôle pour chacune. L'utilisateur recevra un email avec un mot de passe temporaire.",
  },
  {
    q: "Comment générer une quittance de loyer ?",
    a: "Allez dans Facturation, sélectionnez une facture payée, puis cliquez sur « Générer la quittance ». Le PDF est généré automatiquement et peut être envoyé par email au locataire.",
  },
  {
    q: "Puis-je gérer plusieurs sociétés et propriétaires ?",
    a: "Oui, selon votre plan. Le plan Starter permet 1 société, le Pro jusqu'à 3, et l'Enterprise un nombre illimité. Chaque société est rattachée à un propriétaire. La vue Propriétaire consolide les données de l'ensemble.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Les données bancaires sont chiffrées en AES-256-GCM, les mots de passe sont hachés avec bcrypt, et l'application utilise HTTPS avec des en-têtes de sécurité stricts. L'hébergement est en Europe.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Envoyez-nous un email à contact@mygestia.immo. Les clients Enterprise bénéficient d'un support prioritaire avec un temps de réponse garanti.",
  },
];

export default function AidePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3">Centre d&apos;aide</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Guides détaillés et réponses aux questions fréquentes pour tirer le meilleur de {APP_NAME}.
          </p>
        </div>

        {/* Guides — grille cliquable */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Guides par module</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/aide/${guide.slug}`}
                className="group flex items-start gap-4 border rounded-xl p-5 hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${guide.color}`}>
                  {guide.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">{guide.title}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{guide.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            Questions fréquentes
          </h2>
          <div className="space-y-4 max-w-3xl">
            {faqs.map((faq) => (
              <div key={faq.q} className="border rounded-lg p-5">
                <h3 className="font-medium mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact support */}
        <section className="text-center bg-muted/50 rounded-2xl p-8">
          <Mail className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Besoin d&apos;aide supplémentaire ?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Notre équipe est disponible pour répondre à vos questions.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/contact"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              Nous contacter
            </Link>
            <a
              href="mailto:contact@mygestia.immo"
              className="border px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-accent"
            >
              contact@mygestia.immo
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
