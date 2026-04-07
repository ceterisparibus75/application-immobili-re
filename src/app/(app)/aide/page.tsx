import { Building2, BookOpen, Mail, Shield, FileText, Users, BarChart3, Banknote, HelpCircle, Layers, TrendingUp, FolderLock, UserCog } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Centre d'aide | ${APP_NAME}`,
  description: "Guides, FAQ et support pour la gestion de votre patrimoine immobilier",
};

const guides = [
  {
    icon: <Building2 className="h-5 w-5" />,
    title: "Démarrage rapide",
    description: "Créez votre société, ajoutez vos immeubles et lots, et commencez à gérer en quelques minutes.",
    items: [
      "Suivez le guide de démarrage interactif à la première connexion",
      "Créer une société (SCI, SARL, personne physique, etc.)",
      "Ajouter un immeuble, ses lots et leurs diagnostics",
      "Enregistrer un locataire et créer un bail",
      "Profitez de 14 jours d'essai gratuit sans carte bancaire",
    ],
  },
  {
    icon: <UserCog className="h-5 w-5" />,
    title: "Utilisateurs et droits d'accès",
    description: "Gérez les utilisateurs, les rôles et les permissions par société et par module.",
    items: [
      "5 rôles hiérarchiques : Super Admin, Admin Société, Gestionnaire, Comptable, Lecture seule",
      "Chaque utilisateur est rattaché à une ou plusieurs sociétés avec un rôle par société",
      "L'accès aux propriétaires est automatique : un utilisateur voit le propriétaire de ses sociétés",
      "Permissions par module personnalisables (patrimoine, baux, facturation, comptabilité, etc.)",
      "L'administrateur peut créer des utilisateurs, assigner des rôles et personnaliser les droits",
    ],
  },
  {
    icon: <Building2 className="h-5 w-5" />,
    title: "Gestion du patrimoine",
    description: "Gérez vos immeubles, lots, diagnostics, maintenances et inspections.",
    items: [
      "Fiche immeuble complète avec adresse, informations cadastrales et photos",
      "Lots avec surface, étage, type (habitation, commercial, parking, etc.)",
      "Suivi des diagnostics obligatoires (DPE, amiante, plomb, etc.) avec alertes d'expiration",
      "Maintenances et interventions techniques avec historique",
      "États des lieux d'entrée et de sortie détaillés",
    ],
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Gestion locative",
    description: "Baux, locataires, révisions de loyer, charges et contacts.",
    items: [
      "Baux complets avec loyer, charges, dépôt de garantie et clauses",
      "Fiche locataire (personne physique ou morale) avec documents",
      "Révisions automatiques de loyer selon l'indice IRL/ILC/ILAT",
      "Gestion des charges et provisions avec régularisation annuelle",
      "Carnet de contacts (artisans, notaires, assureurs, etc.)",
    ],
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Facturation et paiements",
    description: "Factures automatiques, paiements, relances, SEPA et quittances.",
    items: [
      "Génération automatique des factures brouillons chaque mois",
      "Enregistrement des paiements (total, partiel, multi-factures)",
      "Relances automatiques en 3 niveaux par email",
      "Génération de mandats et fichiers de prélèvement SEPA",
      "Quittances de loyer en PDF envoyées par email",
    ],
  },
  {
    icon: <Banknote className="h-5 w-5" />,
    title: "Banque et comptabilité",
    description: "Connectez vos comptes bancaires et rapprochez les transactions.",
    items: [
      "Ajoutez un compte bancaire manuellement ou via connexion Open Banking",
      "Importez vos transactions bancaires automatiquement",
      "Rapprochez les transactions avec les factures en quelques clics",
      "Consultez vos écritures comptables et exportez en FEC",
    ],
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "Vue Propriétaire",
    description: "Tableau de bord consolidé pour piloter toutes vos sociétés d'un seul coup d'œil.",
    items: [
      "KPIs agrégés (revenus, occupation, impayés, trésorerie) sur toutes vos sociétés",
      "Tableau de performance par société avec comparaison",
      "Vue consolidée de l'endettement et des prêteurs",
      "Graphiques de revenus, occupation et patrimoine multi-sociétés",
      "Accès rapide aux tâches urgentes (diagnostics, baux, impayés)",
    ],
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: "Évaluations IA et emprunts",
    description: "Estimez la valeur de votre patrimoine et gérez vos emprunts bancaires.",
    items: [
      "Évaluation automatique de la valeur du patrimoine par intelligence artificielle",
      "Gestion des emprunts : amortissable, in fine ou bullet",
      "Tableau d'amortissement détaillé avec échéances",
      "Suivi du ratio LTV (Loan-to-Value) et de l'endettement global",
      "Alertes sur les échéances à venir",
    ],
  },
  {
    icon: <FolderLock className="h-5 w-5" />,
    title: "Documents, Dataroom et signatures",
    description: "Stockez, partagez et faites signer vos documents en toute sécurité.",
    items: [
      "Stockage sécurisé de tous vos documents (baux, diagnostics, factures, etc.)",
      "Dataroom partagée pour vos partenaires (banques, notaires, acquéreurs)",
      "Signature électronique des documents directement dans l'application",
      "Organisation automatique par catégorie et par bien",
      "Accès sécurisé avec lien de partage à durée limitée",
    ],
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Tableau de bord et rapports",
    description: "Visualisez vos KPI, analysez les tendances et générez des rapports détaillés.",
    items: [
      "Taux d'occupation, loyers perçus, impayés et trésorerie en temps réel",
      "Graphiques interactifs : revenus mensuels, occupation, répartition du patrimoine",
      "Analyse de la concentration des risques (locataires, secteurs)",
      "Timeline des baux avec alertes d'échéance",
      "Export FEC réglementaire et rapports comptables personnalisables",
    ],
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Sécurité et confidentialité",
    description: "Protégez votre compte, vos données et celles de vos locataires.",
    items: [
      "Authentification à deux facteurs (2FA) pour tous les utilisateurs",
      "5 niveaux de rôles avec permissions personnalisables par module et par société",
      "Données bancaires chiffrées en AES-256-GCM, mots de passe hachés bcrypt",
      "Portail locataire sécurisé avec lien d'accès individuel",
      "Module RGPD intégré : consentements, droit d'accès, suppression et audit logs complets",
    ],
  },
];

const faqs = [
  {
    q: "Comment ajouter un nouvel utilisateur à ma société ?",
    a: "Allez dans Mon compte > Utilisateurs > Créer un utilisateur. Renseignez son nom, prénom et email, puis sélectionnez la ou les sociétés auxquelles il aura accès avec un rôle pour chacune (Admin Société, Gestionnaire, Comptable ou Lecture). L'utilisateur recevra un email avec un mot de passe temporaire.",
  },
  {
    q: "Comment générer une quittance de loyer ?",
    a: "Allez dans Facturation, sélectionnez une facture payée, puis cliquez sur « Générer la quittance ». Le PDF est généré automatiquement et peut être envoyé par email au locataire.",
  },
  {
    q: "Comment fonctionne la révision de loyer ?",
    a: "Les révisions sont calculées automatiquement selon l'indice IRL/ILC/ILAT du bail. Elles apparaissent dans le module Révisions lorsqu'elles sont dues. Vous pouvez les valider ou les rejeter.",
  },
  {
    q: "Puis-je gérer plusieurs sociétés et propriétaires ?",
    a: "Oui, selon votre plan. Le plan Starter permet 1 société, le Pro jusqu'à 3, et l'Enterprise un nombre illimité. Chaque société est rattachée à un propriétaire (personne physique ou morale). Un utilisateur voit automatiquement les propriétaires dont il gère au moins une société. La vue Propriétaire consolide les données de l'ensemble.",
  },
  {
    q: "Comment exporter mes données comptables ?",
    a: "Allez dans Comptabilité > Export FEC. Sélectionnez la période souhaitée et cliquez sur Exporter. Le fichier FEC est généré au format réglementaire français.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Les données bancaires sont chiffrées en AES-256-GCM, les mots de passe sont hachés avec bcrypt, et l'application utilise HTTPS avec des en-têtes de sécurité stricts (HSTS, CSP). L'hébergement est en Europe (Supabase Frankfurt).",
  },
  {
    q: "Comment annuler mon abonnement ?",
    a: "Allez dans Paramètres > Facturation > Annuler l'abonnement. Vous conserverez l'accès jusqu'à la fin de la période en cours, avec 30 jours pour exporter vos données.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Envoyez-nous un email à contact@mygestia.immo. Les clients Enterprise bénéficient d'un support prioritaire avec un temps de réponse garanti.",
  },
  {
    q: "Comment fonctionne la vue Propriétaire ?",
    a: "La vue Propriétaire consolide les données de toutes vos sociétés sur un seul tableau de bord. Vous y retrouvez les KPIs agrégés (revenus, occupation, impayés, trésorerie), un tableau de performance par société, et tous les graphiques détaillés.",
  },
  {
    q: "Comment utiliser les évaluations IA ?",
    a: "L'évaluation IA estime automatiquement la valeur de votre patrimoine en se basant sur les données du marché. Accédez-y depuis la fiche d'un immeuble ou depuis le tableau de bord. Les estimations sont mises à jour régulièrement.",
  },
  {
    q: "Comment gérer mes emprunts ?",
    a: "Allez dans Emprunts > Nouveau. Renseignez le type (amortissable, in fine ou bullet), le montant, le taux et la durée. L'application génère automatiquement le tableau d'amortissement et suit vos échéances.",
  },
  {
    q: "Qu'est-ce que la Dataroom ?",
    a: "La Dataroom est un espace de partage sécurisé pour vos documents. Vous pouvez générer des liens d'accès à durée limitée pour vos partenaires (banques, notaires, acquéreurs) sans leur donner accès à toute l'application.",
  },
  {
    q: "Comment fonctionne le prélèvement SEPA ?",
    a: "Depuis Facturation > SEPA, générez des mandats de prélèvement pour vos locataires. Vous pouvez ensuite générer un fichier SEPA regroupant les prélèvements du mois, à transmettre à votre banque.",
  },
  {
    q: "Comment mes locataires accèdent au portail ?",
    a: "Chaque locataire reçoit un lien d'accès sécurisé à son portail personnel. Il peut y consulter ses factures, quittances, documents du bail et effectuer ses paiements en ligne.",
  },
  {
    q: "Comment générer des rapports avancés ?",
    a: "Depuis le tableau de bord, accédez aux rapports détaillés : revenus mensuels, taux d'occupation, analyse des impayés, évolution du patrimoine. Tous les rapports sont exportables en PDF ou Excel.",
  },
  {
    q: "Quels sont les différents rôles utilisateurs ?",
    a: "Il existe 5 rôles, du plus élevé au plus bas : Super Administrateur (accès total à toutes les sociétés), Admin Société (gestion complète d'une société et de ses utilisateurs), Gestionnaire (gestion quotidienne du patrimoine, baux, locataires), Comptable (lecture partout + écriture sur facturation, comptabilité, banque et relances), Lecture seule (consultation uniquement).",
  },
  {
    q: "Comment un utilisateur accède-t-il à un propriétaire ?",
    a: "L'accès est automatique et indirect : un utilisateur voit le propriétaire de chaque société dont il est membre. Par exemple, si vous êtes gestionnaire de la SCI Soleil (rattachée au propriétaire Marie Dupont), vous verrez Marie Dupont dans votre barre de navigation, sans avoir besoin d'un accès direct au propriétaire.",
  },
  {
    q: "Peut-on personnaliser les droits d'un utilisateur ?",
    a: "Oui. Par défaut, chaque rôle donne des droits prédéfinis sur 12 modules (patrimoine, baux, locataires, facturation, etc.). Un administrateur peut ensuite personnaliser les permissions module par module pour chaque utilisateur : par exemple, donner l'accès écriture sur la facturation à un utilisateur en Lecture seule.",
  },
  {
    q: "Qui peut modifier les informations d'un propriétaire ?",
    a: "Le créateur du propriétaire et tout utilisateur ayant le rôle Admin Société ou Super Admin sur l'une des sociétés rattachées à ce propriétaire. Cela inclut la possibilité de passer d'une personne physique à une personne morale (SCI, SARL, etc.).",
  },
  {
    q: "Comment fonctionne la copie carbone (BCC) des emails ?",
    a: "Chaque utilisateur peut recevoir en copie cachée les emails envoyés aux locataires (relances, quittances, etc.). Un administrateur peut activer ou désactiver cette option pour n'importe quel utilisateur de ses sociétés. Un gestionnaire ne peut l'activer que pour lui-même.",
  },
];

export default function AidePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3">Centre d&apos;aide</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Guides pratiques et réponses aux questions fréquentes pour tirer le meilleur de {APP_NAME}.
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
                      <span className="text-primary mt-1">&bull;</span>
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
