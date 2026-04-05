import { Building2, BookOpen, Mail, Shield, CreditCard, FileText, Users, BarChart3, Banknote, HelpCircle } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

export const metadata = {
  title: `Centre d'aide | ${APP_NAME}`,
  description: "Guides, FAQ et support pour la gestion de votre patrimoine immobilier",
};

const guides = [
  {
    icon: <Building2 className="h-5 w-5" />,
    title: "Demarrage rapide",
    description: "Creez votre societe, ajoutez vos immeubles et lots, et commencez a gerer.",
    items: [
      "Creer une societe (SCI, SARL, etc.)",
      "Ajouter un immeuble et ses lots",
      "Enregistrer un locataire",
      "Creer un bail et associer un locataire a un lot",
    ],
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Facturation",
    description: "Generez des factures, quittances et suivez les paiements.",
    items: [
      "Les factures brouillons sont generees automatiquement",
      "Validez et envoyez les factures par email",
      "Enregistrez les paiements recus",
      "Generez des quittances de loyer en PDF",
    ],
  },
  {
    icon: <Banknote className="h-5 w-5" />,
    title: "Banque et comptabilite",
    description: "Connectez vos comptes bancaires et rapprochez les transactions.",
    items: [
      "Ajoutez un compte bancaire manuellement ou via connexion Open Banking",
      "Importez vos transactions bancaires",
      "Rapprochez les transactions avec les factures",
      "Consultez vos ecritures comptables et exportez en FEC",
    ],
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Gestion des locataires",
    description: "Suivez vos locataires, leurs documents et communications.",
    items: [
      "Fiche locataire complete (identite, contact, documents)",
      "Portail locataire pour consultation des documents",
      "Relances automatiques en cas d'impayes",
      "Historique des echanges et notifications",
    ],
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Tableau de bord et rapports",
    description: "Visualisez vos KPI et generez des rapports.",
    items: [
      "Taux d'occupation, loyers percus, impayes",
      "Graphiques de revenus et depenses",
      "Rapports personnalisables par periode",
      "Export des donnees en Excel",
    ],
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Securite et confidentialite",
    description: "Protegez votre compte et les donnees de vos locataires.",
    items: [
      "Activez l'authentification a deux facteurs (2FA)",
      "Gerez les roles et permissions de votre equipe",
      "Donnees bancaires chiffrees (AES-256)",
      "Module RGPD integre pour les droits des locataires",
    ],
  },
];

const faqs = [
  {
    q: "Comment ajouter un nouvel utilisateur a ma societe ?",
    a: "Allez dans Administration > Utilisateurs > Inviter. L'utilisateur recevra un email avec ses identifiants. Vous pouvez lui attribuer un role (Gestionnaire, Comptable, Lecture seule).",
  },
  {
    q: "Comment generer une quittance de loyer ?",
    a: "Allez dans Facturation, selectionnez une facture payee, puis cliquez sur 'Generer la quittance'. Le PDF est genere automatiquement et peut etre envoye par email au locataire.",
  },
  {
    q: "Comment fonctionne la revision de loyer ?",
    a: "Les revisions sont calculees automatiquement selon l'indice IRL/ILC/ILAT du bail. Elles apparaissent dans le module Revisions lorsqu'elles sont dues. Vous pouvez les valider ou les rejeter.",
  },
  {
    q: "Puis-je gerer plusieurs societes ?",
    a: "Oui, selon votre plan. Le plan Starter permet 1 societe, le Pro jusqu'a 3, et l'Enterprise un nombre illimite. Chaque societe a ses propres donnees isolees.",
  },
  {
    q: "Comment exporter mes donnees comptables ?",
    a: "Allez dans Comptabilite > Export FEC. Selectionnez la periode souhaitee et cliquez sur Exporter. Le fichier FEC est genere au format reglementaire.",
  },
  {
    q: "Mes donnees sont-elles securisees ?",
    a: "Oui. Les donnees bancaires sont chiffrees en AES-256-GCM, les mots de passe sont haches avec bcrypt, et l'application utilise HTTPS avec des en-tetes de securite stricts (HSTS, CSP). L'hebergement est en Europe (Supabase Frankfurt).",
  },
  {
    q: "Comment annuler mon abonnement ?",
    a: "Allez dans Parametres > Facturation > Annuler l'abonnement. Vous conserverez l'acces jusqu'a la fin de la periode en cours, avec 30 jours pour exporter vos donnees.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Envoyez-nous un email a contact@mtggroupe.org. Les clients Enterprise beneficient d'un support prioritaire avec un temps de reponse garanti.",
  },
];

export default function AidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Tarifs</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link href="/login" className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
              Se connecter
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3">Centre d&apos;aide</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Guides pratiques et reponses aux questions frequentes pour tirer le meilleur de {APP_NAME}.
          </p>
        </div>

        {/* Guides */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Guides par module</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((guide) => (
              <div key={guide.title} className="border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-primary">{guide.icon}</div>
                  <h3 className="font-semibold">{guide.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{guide.description}</p>
                <ul className="space-y-2">
                  {guide.items.map((item) => (
                    <li key={item} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            Questions frequentes
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
          <h2 className="text-xl font-bold mb-2">Besoin d&apos;aide supplementaire ?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Notre equipe est disponible pour repondre a vos questions.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/contact"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              Nous contacter
            </Link>
            <a
              href="mailto:contact@mtggroupe.org"
              className="border px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-accent"
            >
              contact@mtggroupe.org
            </a>
          </div>
        </section>

        <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground flex justify-center gap-4">
          <Link href="/cgu" className="hover:underline">CGU</Link>
          <Link href="/cgv" className="hover:underline">CGV</Link>
          <Link href="/dpa" className="hover:underline">DPA</Link>
          <Link href="/mentions-legales" className="hover:underline">Mentions legales</Link>
        </div>
      </main>
    </div>
  );
}
