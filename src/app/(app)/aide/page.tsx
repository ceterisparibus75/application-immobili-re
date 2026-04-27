import {
  Building2,
  BookOpen,
  Mail,
  Shield,
  FileText,
  Users,
  BarChart3,
  Banknote,
  HelpCircle,
  Layers,
  TrendingUp,
  FolderLock,
  UserCog,
  ChevronRight,
  CalendarCheck,
  Umbrella,
  Building,
  Zap,
  Send,
  Wrench,
  BookMarked,
  Sparkles,
  ArrowRight,
  FileQuestion,
} from "lucide-react";
import Link from "next/link";
import { HelpSearch } from "./_components/help-search";
import { FaqAccordion } from "./_components/faq-accordion";

import { APP_NAME } from "@/lib/constants";

export const metadata = {
  title: `Centre d'aide | ${APP_NAME}`,
  description: "Guides, FAQ et support pour la gestion de votre patrimoine immobilier",
};

// ─── Données sérialisables (pour la recherche côté client) ──────────────────

const searchableGuides = [
  { slug: "demarrage", title: "Démarrage rapide", description: "Créez votre société, ajoutez vos immeubles et commencez à gérer en quelques minutes." },
  { slug: "utilisateurs", title: "Utilisateurs et droits d'accès", description: "Gérez les utilisateurs, les rôles et les permissions par société et par module." },
  { slug: "patrimoine", title: "Gestion du patrimoine", description: "Immeubles, lots, diagnostics, maintenances et états des lieux." },
  { slug: "locatif", title: "Gestion locative", description: "Baux, locataires, révisions de loyer, charges et contacts." },
  { slug: "facturation", title: "Facturation et paiements", description: "Factures, paiements, relances automatiques, SEPA et quittances." },
  { slug: "banque", title: "Banque et comptabilité", description: "Comptes bancaires, rapprochement, écritures comptables et export FEC." },
  { slug: "proprietaire", title: "Vue Propriétaire", description: "Tableau de bord consolidé multi-sociétés et gestion des propriétaires." },
  { slug: "emprunts", title: "Évaluations IA et emprunts", description: "Estimation du patrimoine par IA, emprunts et tableaux d'amortissement." },
  { slug: "documents", title: "Documents, Dataroom et signatures", description: "Stockage sécurisé, partage de documents et signatures électroniques." },
  { slug: "dashboard", title: "Tableau de bord et rapports", description: "KPI en temps réel, graphiques interactifs et rapports exportables." },
  { slug: "securite", title: "Sécurité et confidentialité", description: "Protection des données, RGPD, 2FA et portail locataire." },
  { slug: "candidatures", title: "Candidatures locataires", description: "Pipeline de sélection, scoring des dossiers et suivi des visites étape par étape." },
  { slug: "saisonnier", title: "Location saisonnière", description: "Gestion des biens saisonniers, réservations, tarification et revenus par nuitée." },
  { slug: "copropriete", title: "Copropriété", description: "Tantièmes, assemblées générales, budgets prévisionnels et gestion des lots en copropriété." },
  { slug: "courriers-relances", title: "Courriers et relances", description: "Modèles de lettres conformes, relances automatiques à 3 niveaux et génération de courriers IA." },
  { slug: "automatisation", title: "Automatisation et IA", description: "Workflows automatisés, assistant IA, prédiction d'impayés, import intelligent et tickets." },
  { slug: "glossaire", title: "Glossaire immobilier", description: "Tous les termes essentiels expliqués : IRL, ILC, LTV, FEC, tantièmes, charges récupérables, SEPA…" },
  { slug: "depannage", title: "Problèmes fréquents et solutions", description: "Solutions pas à pas pour les problèmes les plus courants : connexion, emails, factures, banque, portail." },
];

// ─── Grille des guides (avec icônes) ────────────────────────────────────────

const guides = [
  {
    slug: "demarrage",
    icon: <Building2 className="h-5 w-5" />,
    title: "Démarrage rapide",
    description: "Créez votre société, ajoutez vos immeubles et commencez à gérer en quelques minutes.",
    color: "bg-blue-500/10 text-blue-600",
    popular: true,
  },
  {
    slug: "utilisateurs",
    icon: <UserCog className="h-5 w-5" />,
    title: "Utilisateurs et droits",
    description: "Rôles, permissions par module et accès multi-sociétés.",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    slug: "patrimoine",
    icon: <Building2 className="h-5 w-5" />,
    title: "Gestion du patrimoine",
    description: "Immeubles, lots, diagnostics, maintenances et états des lieux.",
    color: "bg-emerald-500/10 text-emerald-600",
    popular: true,
  },
  {
    slug: "locatif",
    icon: <Users className="h-5 w-5" />,
    title: "Gestion locative",
    description: "Baux, locataires, révisions de loyer, charges et contacts.",
    color: "bg-amber-500/10 text-amber-600",
    popular: true,
  },
  {
    slug: "facturation",
    icon: <FileText className="h-5 w-5" />,
    title: "Facturation et paiements",
    description: "Factures, paiements, relances, SEPA et quittances.",
    color: "bg-rose-500/10 text-rose-600",
    popular: true,
  },
  {
    slug: "banque",
    icon: <Banknote className="h-5 w-5" />,
    title: "Banque et comptabilité",
    description: "Rapprochement, écritures comptables et export FEC.",
    color: "bg-cyan-500/10 text-cyan-600",
  },
  {
    slug: "proprietaire",
    icon: <Layers className="h-5 w-5" />,
    title: "Vue Propriétaire",
    description: "Tableau de bord consolidé multi-sociétés.",
    color: "bg-indigo-500/10 text-indigo-600",
  },
  {
    slug: "emprunts",
    icon: <TrendingUp className="h-5 w-5" />,
    title: "Évaluations IA et emprunts",
    description: "Estimation IA, emprunts et tableaux d'amortissement.",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    slug: "documents",
    icon: <FolderLock className="h-5 w-5" />,
    title: "Documents et signatures",
    description: "Stockage sécurisé, dataroom et signatures électroniques.",
    color: "bg-teal-500/10 text-teal-600",
  },
  {
    slug: "dashboard",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Tableau de bord et rapports",
    description: "KPI en temps réel, graphiques et 9 types de rapports.",
    color: "bg-pink-500/10 text-pink-600",
  },
  {
    slug: "securite",
    icon: <Shield className="h-5 w-5" />,
    title: "Sécurité et RGPD",
    description: "Chiffrement, 2FA, audit, conformité RGPD et portail locataire.",
    color: "bg-slate-500/10 text-slate-600",
  },
  {
    slug: "candidatures",
    icon: <CalendarCheck className="h-5 w-5" />,
    title: "Candidatures locataires",
    description: "Pipeline Kanban, scoring des dossiers et suivi des visites.",
    color: "bg-lime-500/10 text-lime-600",
  },
  {
    slug: "saisonnier",
    icon: <Umbrella className="h-5 w-5" />,
    title: "Location saisonnière",
    description: "Biens saisonniers, réservations, tarification et revenus.",
    color: "bg-sky-500/10 text-sky-600",
  },
  {
    slug: "copropriete",
    icon: <Building className="h-5 w-5" />,
    title: "Copropriété",
    description: "Tantièmes, AG, budgets et gestion des lots en copropriété.",
    color: "bg-fuchsia-500/10 text-fuchsia-600",
  },
  {
    slug: "courriers-relances",
    icon: <Send className="h-5 w-5" />,
    title: "Courriers et relances",
    description: "Modèles conformes, relances automatiques et génération IA.",
    color: "bg-red-500/10 text-red-600",
  },
  {
    slug: "automatisation",
    icon: <Zap className="h-5 w-5" />,
    title: "Automatisation et IA",
    description: "Workflows, assistant IA, import intelligent et tickets.",
    color: "bg-yellow-500/10 text-yellow-600",
  },
];

// Ressources spéciales (Glossaire + Dépannage)
const specialResources = [
  {
    slug: "glossaire",
    icon: <BookMarked className="h-5 w-5" />,
    title: "Glossaire immobilier",
    description: "IRL, LTV, FEC, tantièmes, charges récupérables et tous les termes essentiels expliqués.",
    color: "bg-purple-500/10 text-purple-600",
    badge: "Référence",
  },
  {
    slug: "depannage",
    icon: <Wrench className="h-5 w-5" />,
    title: "Problèmes fréquents",
    description: "Connexion, emails, factures, banque, portail locataire — solutions pas à pas.",
    color: "bg-red-500/10 text-red-600",
    badge: "Dépannage",
  },
];

// ─── FAQ ────────────────────────────────────────────────────────────────────

const faqs = [
  // Compte et connexion
  { q: "Comment ajouter un nouvel utilisateur à ma société ?", a: "Allez dans Mon compte > Utilisateurs > Créer un utilisateur. Renseignez son nom, prénom et email, puis sélectionnez la ou les sociétés auxquelles il aura accès avec un rôle pour chacune. L'utilisateur recevra un email avec un mot de passe temporaire." },
  { q: "Comment réinitialiser mon mot de passe ?", a: "Sur la page de connexion, cliquez sur « Mot de passe oublié » et saisissez votre adresse email. Vous recevrez un lien de réinitialisation valable 24 heures. Si vous ne recevez pas l'email, vérifiez votre dossier de courriers indésirables." },
  { q: "Que se passe-t-il si mon compte est verrouillé ?", a: "Après 5 tentatives de connexion échouées, votre compte est automatiquement verrouillé pendant 15 minutes par mesure de sécurité. Attendez la fin du délai puis réessayez. Si le problème persiste, utilisez « Mot de passe oublié »." },
  { q: "Comment activer la double authentification (2FA) ?", a: "Allez dans Mon compte > Sécurité > Authentification à deux facteurs, puis cliquez sur « Activer ». Scannez le QR code avec Google Authenticator, Authy ou une appli similaire et saisissez le code à 6 chiffres. Conservez précieusement vos codes de récupération." },
  // Abonnement
  { q: "L'essai gratuit est-il sans engagement ?", a: "Oui, l'essai de 14 jours est entièrement gratuit et sans carte bancaire. À la fin de la période, votre compte passe en lecture seule. Vous pouvez souscrire à tout moment pour retrouver l'accès complet." },
  { q: "Quelles sont les différences entre les plans Starter, Pro et Enterprise ?", a: "Le plan Starter permet jusqu'à 20 lots, 1 société et 2 utilisateurs. Le Pro monte à 50 lots, 3 sociétés et 5 utilisateurs. L'Enterprise est sans limite et inclut la signature électronique, l'import IA et l'accès API." },
  { q: "Comment annuler mon abonnement ?", a: "Allez dans Mon compte > Abonnement > Annuler l'abonnement. Votre accès reste actif jusqu'à la fin de la période de facturation en cours. Après cette date, votre compte passe en lecture seule mais vos données sont conservées." },
  { q: "Mes données sont-elles supprimées si j'annule ?", a: "Non, vos données ne sont jamais supprimées automatiquement lors d'une annulation. Votre compte passe en lecture seule et vos données restent disponibles. Vous pouvez les exporter à tout moment via les boutons d'export CSV présents sur chaque module." },
  // Patrimoine
  { q: "Un lot peut-il avoir plusieurs baux en même temps ?", a: "Non, chaque lot ne peut avoir qu'un seul bail actif à la fois. Pour créer un nouveau bail sur un lot, vous devez d'abord résilier le bail en cours. L'historique de tous les baux passés reste consultable dans la fiche du lot." },
  { q: "Comment gérer les diagnostics obligatoires ?", a: "Dans la fiche d'un immeuble ou d'un lot, rendez-vous dans l'onglet « Diagnostics ». Vous pouvez y ajouter tous les diagnostics (DPE, amiante, plomb, gaz, électricité, etc.) avec leur date de réalisation et d'expiration. L'application vous alerte automatiquement avant l'échéance." },
  { q: "Puis-je gérer plusieurs sociétés et propriétaires ?", a: "Oui, selon votre plan. Le plan Starter permet 1 société, le Pro jusqu'à 3, et l'Enterprise un nombre illimité. Chaque société est rattachée à un propriétaire. La vue Propriétaire consolide les données de l'ensemble." },
  // Baux et locataires
  { q: "Comment résilier un bail ?", a: "Allez dans Baux, ouvrez le bail concerné et cliquez sur « Résilier le bail ». Indiquez la date de résiliation et le motif. Attention : un bail résilié ne peut pas être réactivé. Si le locataire revient, il faudra créer un nouveau bail." },
  { q: "Comment ajouter un avenant au bail ?", a: "Ouvrez le bail concerné dans Baux, puis utilisez le bouton « Ajouter un avenant ». L'avenant permet de modifier des clauses spécifiques (loyer, charges, occupation) sans résilier le bail. Le document est stocké automatiquement dans les pièces jointes du bail." },
  { q: "Comment sont calculées les révisions de loyer ?", a: "Les révisions utilisent les indices IRL, ILC, ILAT ou ICC publiés par l'INSEE, synchronisés automatiquement chaque trimestre. Le calcul applique la formule légale : nouveau loyer = ancien loyer × (nouvel indice / ancien indice). Retrouvez le détail dans le guide Gestion locative." },
  { q: "Comment gérer un bail commercial 3/6/9 ?", a: "Lors de la création du bail, sélectionnez le type « Commercial ». Renseignez la durée totale (9 ans) et les périodes triennales. L'application gère automatiquement les révisions de loyer avec l'indice ILC ou ILAT et vous alerte avant chaque échéance triennale." },
  // Facturation
  { q: "Comment générer une quittance de loyer ?", a: "Allez dans Facturation, sélectionnez une facture payée, puis cliquez sur « Générer la quittance ». Le PDF est généré automatiquement et peut être envoyé par email au locataire." },
  { q: "Comment annuler une facture déjà validée ?", a: "Une facture validée ne peut pas être supprimée pour des raisons comptables. Vous devez créer un avoir (facture d'annulation) qui viendra compenser la facture initiale. Allez dans la facture concernée et cliquez sur « Générer un avoir »." },
  { q: "Comment gérer un paiement partiel ?", a: "Lors de l'enregistrement d'un paiement, saisissez le montant effectivement reçu même s'il est inférieur au total. La facture passera en statut « Partiellement payée » et le solde restant restera visible pour le suivi." },
  { q: "Comment régulariser les charges annuelles ?", a: "Allez dans Charges > Régularisation. Sélectionnez l'immeuble et la période. L'application compare les provisions versées aux charges réelles et calcule automatiquement le trop-perçu ou le complément à réclamer." },
  // Banque et comptabilité
  { q: "Comment connecter mon compte bancaire ?", a: "Allez dans Banque > Connexion bancaire. L'intégration Open Banking (via Powens ou GoCardless) synchronise automatiquement vos transactions. Vous pouvez aussi ajouter des transactions manuellement ou via import CSV." },
  { q: "Comment exporter le FEC pour mon comptable ?", a: "Allez dans Comptabilité > Export FEC. Sélectionnez l'exercice comptable concerné, puis cliquez sur « Générer le FEC ». Le fichier au format réglementaire est téléchargé et peut être transmis directement à votre expert-comptable." },
  { q: "Ma banque n'apparaît pas dans la connexion bancaire, que faire ?", a: "L'intégration Open Banking couvre la majorité des banques françaises et européennes. Si votre banque n'apparaît pas, vous pouvez ajouter vos transactions manuellement ou via import CSV. Contactez le support pour demander l'ajout de votre établissement." },
  // Documents et portail
  { q: "Quels formats de fichiers sont acceptés ?", a: "L'application accepte les formats PDF, JPG, PNG et WEBP. La taille maximale par fichier est de 20 Mo. Les documents sont stockés de manière sécurisée dans un espace de stockage chiffré en Europe (Supabase Frankfurt)." },
  { q: "Comment partager des documents via la Dataroom ?", a: "Allez dans Documents > Dataroom. Créez un espace de partage, sélectionnez les documents à inclure et générez un lien sécurisé. Ce lien peut être envoyé à un tiers (acquéreur, notaire, comptable) avec une date d'expiration configurable." },
  { q: "Comment activer le portail pour un locataire ?", a: "Allez dans Locataires, ouvrez la fiche du locataire et cliquez sur « Activer le portail ». Un email d'invitation est envoyé automatiquement avec un lien d'accès sécurisé à son espace personnel." },
  { q: "Que peut faire le locataire sur son portail ?", a: "Le locataire peut consulter ses quittances et factures, télécharger ses documents (bail, courriers), suivre l'état de ses charges, mettre à jour son attestation d'assurance et créer des tickets de demande (maintenance, question, etc.)." },
  // Courriers et relances
  { q: "Comment envoyer un courrier à tous les locataires d'un immeuble ?", a: "Dans Courriers, sélectionnez un modèle puis choisissez le mode « Envoi par immeuble ». Chaque locataire reçoit un courrier personnalisé (nom, adresse, montant du loyer) et le document est automatiquement enregistré dans son espace portail." },
  { q: "Puis-je générer un courrier avec l'IA ?", a: "Oui (plan Enterprise). L'assistant IA rédige des courriers immobiliers sur mesure : relances, mises en demeure, résiliations, demandes d'attestation. Indiquez le sujet et le ton souhaité, l'IA génère un courrier conforme avec les références légales appropriées." },
  // Import / Export
  { q: "Puis-je importer mes données depuis un autre logiciel ?", a: "Oui, Import données permet d'importer des locataires, immeubles et lots depuis un fichier CSV ou Excel. L'import IA (Enterprise) peut aussi extraire les données directement depuis un PDF de bail et préparer immeuble, lot, locataire et bail." },
  { q: "Comment exporter mes données en CSV ?", a: "Chaque page de données (locataires, baux, factures, charges, transactions…) dispose d'un bouton d'export en haut à droite. Le fichier CSV est compatible avec Excel (format français, séparateur point-virgule)." },
  // Rapports
  { q: "Quels rapports puis-je générer ?", a: "9 types de rapports sont disponibles : balance âgée, compte-rendu de gestion, état des impayés, rentabilité par lot, récap charges locataire, situation locative, suivi mensuel, suivi travaux et vacance locative. Vous pouvez aussi planifier des envois automatiques." },
  // Sécurité et RGPD
  { q: "Mes données sont-elles sécurisées ?", a: "Oui. Les données bancaires sont chiffrées en AES-256-GCM, les mots de passe sont hachés avec bcrypt. L'application utilise HTTPS avec des en-têtes de sécurité stricts (CSP, HSTS, X-Frame-Options). L'hébergement est en Europe." },
  { q: "Que couvre la conformité RGPD ?", a: "La section RGPD permet de consulter, exporter et supprimer les données personnelles des locataires. Les durées de conservation légales sont respectées automatiquement et un registre des traitements est accessible." },
  // Technique
  { q: "L'application est lente, que faire ?", a: "Videz le cache de votre navigateur (Ctrl+Shift+Suppr), rechargez la page (Ctrl+F5) et essayez un autre navigateur (Chrome, Firefox, Edge). Si le problème persiste après ces étapes, consultez la page de dépannage ou contactez le support." },
  { q: "Je ne reçois pas les emails de l'application", a: "Vérifiez votre dossier spam. Ajoutez contact@mygestia.immo et noreply@mygestia.immo à vos contacts ou à votre liste blanche. Vérifiez également que votre adresse email est correcte dans Mon compte > Profil." },
  // IA et automatisation
  { q: "Que peut faire l'assistant IA ?", a: "L'assistant IA (plan Enterprise) offre 3 fonctionnalités : (1) Chatbot contextuel — posez des questions en langage naturel sur vos locataires, impayés ou revenus. (2) Générateur de courriers — rédaction automatique de lettres conformes. (3) Prédiction d'impayés — analyse du comportement de paiement sur 12 mois avec score de risque." },
  { q: "Comment fonctionnent les indices INSEE (IRL, ILC, ILAT, ICC) ?", a: "Les 4 indices sont synchronisés automatiquement le 1er de chaque mois depuis l'API INSEE. L'IRL (habitation) est publié ~45 jours après la fin du trimestre, les indices commerciaux ~90 jours. L'application calcule automatiquement les révisions de loyer dues à partir de ces indices." },
  { q: "Comment contacter le support ?", a: "Envoyez-nous un email à contact@mygestia.immo ou utilisez le formulaire de contact accessible depuis le menu. Les clients Enterprise bénéficient d'un support prioritaire avec un temps de réponse garanti sous 4 heures ouvrées." },
];

// ─── Accès rapide par profil ─────────────────────────────────────────────────

const quickPaths = [
  {
    label: "Je démarre",
    description: "Configurer ma première société",
    href: "/aide/demarrage",
    icon: <Sparkles className="h-5 w-5" />,
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20",
    iconColor: "text-blue-600",
  },
  {
    label: "Gérer mes baux",
    description: "Locataires, loyers, révisions",
    href: "/aide/locatif",
    icon: <Users className="h-5 w-5" />,
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20",
    iconColor: "text-amber-600",
  },
  {
    label: "Ma comptabilité",
    description: "Banque, FEC, écritures",
    href: "/aide/banque",
    icon: <Banknote className="h-5 w-5" />,
    color: "border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20",
    iconColor: "text-cyan-600",
  },
  {
    label: "Un problème ?",
    description: "Solutions aux erreurs fréquentes",
    href: "/aide/depannage",
    icon: <Wrench className="h-5 w-5" />,
    color: "border-rose-200 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20",
    iconColor: "text-rose-600",
  },
];

export default function AidePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3">Centre d&apos;aide</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Guides détaillés et réponses aux questions fréquentes pour tirer le meilleur de{" "}
            {APP_NAME}.
          </p>

          {/* Barre de recherche */}
          <HelpSearch guides={searchableGuides} faqs={faqs} />
        </div>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground mb-12">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            18 guides détaillés
          </span>
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4" />
            {faqs.length} questions répondues
          </span>
          <span className="flex items-center gap-1.5">
            <FileQuestion className="h-4 w-4" />
            Glossaire de A à Z
          </span>
        </div>

        {/* ── Accès rapide par profil ───────────────────────────────────────── */}
        <section className="mb-14">
          <h2 className="text-lg font-semibold mb-4">Accès rapide</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickPaths.map((path) => (
              <Link
                key={path.href}
                href={path.href}
                className={`flex items-center gap-3 border rounded-xl p-4 transition-all group ${path.color}`}
              >
                <span className={path.iconColor}>{path.icon}</span>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{path.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{path.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Ressources spéciales (Glossaire + Dépannage) ─────────────────── */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-6">Ressources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {specialResources.map((r) => (
              <Link
                key={r.slug}
                href={`/aide/${r.slug}`}
                className="group flex items-start gap-4 border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all"
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${r.color}`}>{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {r.title}
                    </h3>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {r.badge}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Guides par module ─────────────────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Guides par module</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/aide/${guide.slug}`}
                className="group flex items-start gap-4 border rounded-xl p-5 hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${guide.color}`}>{guide.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {guide.title}
                    </h3>
                    {guide.popular && (
                      <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 hidden sm:inline">
                        Populaire
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{guide.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ accordion ─────────────────────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            Questions fréquentes
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Cliquez sur une question pour afficher la réponse.
          </p>
          <FaqAccordion faqs={faqs} />
        </section>

        {/* ── Contact support ───────────────────────────────────────────────── */}
        <section className="bg-muted/50 rounded-2xl p-8 text-center">
          <Mail className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Besoin d&apos;aide supplémentaire ?</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Notre équipe est disponible pour répondre à vos questions.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Clients Enterprise : réponse garantie sous 4 heures ouvrées.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Formulaire de contact
            </Link>
            <a
              href="mailto:contact@mygestia.immo"
              className="border px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
            >
              contact@mygestia.immo
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
