import { Building2, BookOpen, Mail, Shield, CreditCard, FileText, Users, BarChart3, Banknote, HelpCircle, Layers, TrendingUp, FolderLock, UserCog } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Centre d'aide | ${APP_NAME}`,
  description: "Guides, FAQ et support pour la gestion de votre patrimoine immobilier",
};

const guides = [
  {
    icon: <Building2 className="h-5 w-5" />,
    title: "Demarrage rapide",
    description: "Creez votre societe, ajoutez vos immeubles et lots, et commencez a gerer en quelques minutes.",
    items: [
      "Suivez le guide de demarrage interactif a la premiere connexion",
      "Creer une societe (SCI, SARL, personne physique, etc.)",
      "Ajouter un immeuble, ses lots et leurs diagnostics",
      "Enregistrer un locataire et creer un bail",
      "Profitez de 14 jours d'essai gratuit sans carte bancaire",
    ],
  },
  {
    icon: <UserCog className="h-5 w-5" />,
    title: "Utilisateurs et droits d'acces",
    description: "Gerez les utilisateurs, les roles et les permissions par societe et par module.",
    items: [
      "5 roles hierarchiques : Super Admin, Admin Societe, Gestionnaire, Comptable, Lecture seule",
      "Chaque utilisateur est rattache a une ou plusieurs societes avec un role par societe",
      "L'acces aux proprietaires est automatique : un utilisateur voit le proprietaire de ses societes",
      "Permissions par module personnalisables (patrimoine, baux, facturation, comptabilite, etc.)",
      "L'administrateur peut creer des utilisateurs, assigner des roles et personnaliser les droits",
    ],
  },
  {
    icon: <Building2 className="h-5 w-5" />,
    title: "Gestion du patrimoine",
    description: "Gerez vos immeubles, lots, diagnostics, maintenances et inspections.",
    items: [
      "Fiche immeuble complete avec adresse, informations cadastrales et photos",
      "Lots avec surface, etage, type (habitation, commercial, parking, etc.)",
      "Suivi des diagnostics obligatoires (DPE, amiante, plomb, etc.) avec alertes d'expiration",
      "Maintenances et interventions techniques avec historique",
      "Etats des lieux d'entree et de sortie detailles",
    ],
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Gestion locative",
    description: "Baux, locataires, revisions de loyer, charges et contacts.",
    items: [
      "Baux complets avec loyer, charges, depot de garantie et clauses",
      "Fiche locataire (personne physique ou morale) avec documents",
      "Revisions automatiques de loyer selon l'indice IRL/ILC/ILAT",
      "Gestion des charges et provisions avec regularisation annuelle",
      "Carnet de contacts (artisans, notaires, assureurs, etc.)",
    ],
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Facturation et paiements",
    description: "Factures automatiques, paiements, relances, SEPA et quittances.",
    items: [
      "Generation automatique des factures brouillons chaque mois",
      "Enregistrement des paiements (total, partiel, multi-factures)",
      "Relances automatiques en 3 niveaux par email",
      "Generation de mandats et fichiers de prelevement SEPA",
      "Quittances de loyer en PDF envoyees par email",
    ],
  },
  {
    icon: <Banknote className="h-5 w-5" />,
    title: "Banque et comptabilite",
    description: "Connectez vos comptes bancaires et rapprochez les transactions.",
    items: [
      "Ajoutez un compte bancaire manuellement ou via connexion Open Banking",
      "Importez vos transactions bancaires automatiquement",
      "Rapprochez les transactions avec les factures en quelques clics",
      "Consultez vos ecritures comptables et exportez en FEC",
    ],
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "Vue Proprietaire",
    description: "Tableau de bord consolide pour piloter toutes vos societes d'un seul coup d'oeil.",
    items: [
      "KPIs agreges (revenus, occupation, impayes, tresorerie) sur toutes vos societes",
      "Tableau de performance par societe avec comparaison",
      "Vue consolidee de l'endettement et des preteurs",
      "Graphiques de revenus, occupation et patrimoine multi-societes",
      "Acces rapide aux taches urgentes (diagnostics, baux, impayes)",
    ],
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: "Evaluations IA et emprunts",
    description: "Estimez la valeur de votre patrimoine et gerez vos emprunts bancaires.",
    items: [
      "Evaluation automatique de la valeur du patrimoine par intelligence artificielle",
      "Gestion des emprunts : amortissable, in fine ou bullet",
      "Tableau d'amortissement detaille avec echeances",
      "Suivi du ratio LTV (Loan-to-Value) et de l'endettement global",
      "Alertes sur les echeances a venir",
    ],
  },
  {
    icon: <FolderLock className="h-5 w-5" />,
    title: "Documents, Dataroom et signatures",
    description: "Stockez, partagez et faites signer vos documents en toute securite.",
    items: [
      "Stockage securise de tous vos documents (baux, diagnostics, factures, etc.)",
      "Dataroom partagee pour vos partenaires (banques, notaires, acquereurs)",
      "Signature electronique des documents directement dans l'application",
      "Organisation automatique par categorie et par bien",
      "Acces securise avec lien de partage a duree limitee",
    ],
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Tableau de bord et rapports",
    description: "Visualisez vos KPI, analysez les tendances et generez des rapports detailles.",
    items: [
      "Taux d'occupation, loyers percus, impayes et tresorerie en temps reel",
      "Graphiques interactifs : revenus mensuels, occupation, repartition du patrimoine",
      "Analyse de la concentration des risques (locataires, secteurs)",
      "Timeline des baux avec alertes d'echeance",
      "Export FEC reglementaire et rapports comptables personnalisables",
    ],
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Securite et confidentialite",
    description: "Protegez votre compte, vos donnees et celles de vos locataires.",
    items: [
      "Authentification a deux facteurs (2FA) pour tous les utilisateurs",
      "5 niveaux de roles avec permissions personnalisables par module et par societe",
      "Donnees bancaires chiffrees en AES-256-GCM, mots de passe haches bcrypt",
      "Portail locataire securise avec lien d'acces individuel",
      "Module RGPD integre : consentements, droit d'acces, suppression et audit logs complets",
    ],
  },
];

const faqs = [
  {
    q: "Comment ajouter un nouvel utilisateur a ma societe ?",
    a: "Allez dans Mon compte > Utilisateurs > Creer un utilisateur. Renseignez son nom, prenom et email, puis selectionnez la ou les societes auxquelles il aura acces avec un role pour chacune (Admin Societe, Gestionnaire, Comptable ou Lecture). L'utilisateur recevra un email avec un mot de passe temporaire.",
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
    q: "Puis-je gerer plusieurs societes et proprietaires ?",
    a: "Oui, selon votre plan. Le plan Starter permet 1 societe, le Pro jusqu'a 3, et l'Enterprise un nombre illimite. Chaque societe est rattachee a un proprietaire (personne physique ou morale). Un utilisateur voit automatiquement les proprietaires dont il gere au moins une societe. La vue Proprietaire consolide les donnees de l'ensemble.",
  },
  {
    q: "Comment exporter mes donnees comptables ?",
    a: "Allez dans Comptabilite > Export FEC. Selectionnez la periode souhaitee et cliquez sur Exporter. Le fichier FEC est genere au format reglementaire francais.",
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
    a: "Envoyez-nous un email a contact@mygestia.immo. Les clients Enterprise beneficient d'un support prioritaire avec un temps de reponse garanti.",
  },
  {
    q: "Comment fonctionne la vue Proprietaire ?",
    a: "La vue Proprietaire consolide les donnees de toutes vos societes sur un seul tableau de bord. Vous y retrouvez les KPIs agreges (revenus, occupation, impayes, tresorerie), un tableau de performance par societe, et tous les graphiques detailles.",
  },
  {
    q: "Comment utiliser les evaluations IA ?",
    a: "L'evaluation IA estime automatiquement la valeur de votre patrimoine en se basant sur les donnees du marche. Accedez-y depuis la fiche d'un immeuble ou depuis le tableau de bord. Les estimations sont mises a jour regulierement.",
  },
  {
    q: "Comment gerer mes emprunts ?",
    a: "Allez dans Emprunts > Nouveau. Renseignez le type (amortissable, in fine ou bullet), le montant, le taux et la duree. L'application genere automatiquement le tableau d'amortissement et suit vos echeances.",
  },
  {
    q: "Qu'est-ce que la Dataroom ?",
    a: "La Dataroom est un espace de partage securise pour vos documents. Vous pouvez generer des liens d'acces a duree limitee pour vos partenaires (banques, notaires, acquereurs) sans leur donner acces a toute l'application.",
  },
  {
    q: "Comment fonctionne le prelevement SEPA ?",
    a: "Depuis Facturation > SEPA, generez des mandats de prelevement pour vos locataires. Vous pouvez ensuite generer un fichier SEPA regroupant les prelevements du mois, a transmettre a votre banque.",
  },
  {
    q: "Comment mes locataires accedent au portail ?",
    a: "Chaque locataire recoit un lien d'acces securise a son portail personnel. Il peut y consulter ses factures, quittances, documents du bail et effectuer ses paiements en ligne.",
  },
  {
    q: "Comment generer des rapports avances ?",
    a: "Depuis le tableau de bord, accedez aux rapports detailles : revenus mensuels, taux d'occupation, analyse des impayes, evolution du patrimoine. Tous les rapports sont exportables en PDF ou Excel.",
  },
  {
    q: "Quels sont les differents roles utilisateurs ?",
    a: "Il existe 5 roles, du plus eleve au plus bas : Super Administrateur (acces total a toutes les societes), Admin Societe (gestion complete d'une societe et de ses utilisateurs), Gestionnaire (gestion quotidienne du patrimoine, baux, locataires), Comptable (lecture partout + ecriture sur facturation, comptabilite, banque et relances), Lecture seule (consultation uniquement).",
  },
  {
    q: "Comment un utilisateur accede-t-il a un proprietaire ?",
    a: "L'acces est automatique et indirect : un utilisateur voit le proprietaire de chaque societe dont il est membre. Par exemple, si vous etes gestionnaire de la SCI Soleil (rattachee au proprietaire Marie Dupont), vous verrez Marie Dupont dans votre barre de navigation, sans avoir besoin d'un acces direct au proprietaire.",
  },
  {
    q: "Peut-on personnaliser les droits d'un utilisateur ?",
    a: "Oui. Par defaut, chaque role donne des droits predéfinis sur 12 modules (patrimoine, baux, locataires, facturation, etc.). Un administrateur peut ensuite personnaliser les permissions module par module pour chaque utilisateur : par exemple, donner l'acces ecriture sur la facturation a un utilisateur en Lecture seule.",
  },
  {
    q: "Qui peut modifier les informations d'un proprietaire ?",
    a: "Le createur du proprietaire et tout utilisateur ayant le role Admin Societe ou Super Admin sur l'une des societes rattachees a ce proprietaire. Cela inclut la possibilite de passer d'une personne physique a une personne morale (SCI, SARL, etc.).",
  },
  {
    q: "Comment fonctionne le copie carbone (BCC) des emails ?",
    a: "Chaque utilisateur peut recevoir en copie cachee les emails envoyes aux locataires (relances, quittances, etc.). Un administrateur peut activer ou desactiver cette option pour n'importe quel utilisateur de ses societes. Un gestionnaire ne peut l'activer que pour lui-meme.",
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
              href="mailto:contact@mygestia.immo"
              className="border px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-accent"
            >
              contact@mygestia.immo
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
