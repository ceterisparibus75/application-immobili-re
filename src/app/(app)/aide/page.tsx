import { Building2, BookOpen, Mail, Shield, FileText, Users, BarChart3, Banknote, HelpCircle, Layers, TrendingUp, FolderLock, UserCog, ChevronRight, CreditCard, Phone, RefreshCw, Contact, CalendarCheck, Umbrella, Building, TicketCheck, Zap, Bot, Send, Upload, LineChart, BellRing } from "lucide-react";
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
  {
    slug: "candidatures",
    icon: <CalendarCheck className="h-6 w-6" />,
    title: "Candidatures locataires",
    description: "Pipeline de sélection, scoring des dossiers et suivi des visites étape par étape.",
    color: "bg-lime-500/10 text-lime-600",
  },
  {
    slug: "saisonnier",
    icon: <Umbrella className="h-6 w-6" />,
    title: "Location saisonnière",
    description: "Gestion des biens saisonniers, réservations, tarification et revenus par nuitée.",
    color: "bg-sky-500/10 text-sky-600",
  },
  {
    slug: "copropriete",
    icon: <Building className="h-6 w-6" />,
    title: "Copropriété",
    description: "Tantièmes, assemblées générales, budgets prévisionnels et gestion des lots en copropriété.",
    color: "bg-fuchsia-500/10 text-fuchsia-600",
  },
  {
    slug: "courriers-relances",
    icon: <Send className="h-6 w-6" />,
    title: "Courriers et relances",
    description: "Modèles de lettres conformes, relances automatiques à 3 niveaux et génération de courriers IA.",
    color: "bg-red-500/10 text-red-600",
  },
  {
    slug: "automatisation",
    icon: <Zap className="h-6 w-6" />,
    title: "Automatisation et IA",
    description: "Workflows automatisés, assistant IA, prédiction d'impayés, import intelligent et tickets.",
    color: "bg-yellow-500/10 text-yellow-600",
  },
];

const faqs = [
  // ── Compte et connexion ──
  {
    q: "Comment ajouter un nouvel utilisateur à ma société ?",
    a: "Allez dans Mon compte > Utilisateurs > Créer un utilisateur. Renseignez son nom, prénom et email, puis sélectionnez la ou les sociétés auxquelles il aura accès avec un rôle pour chacune. L'utilisateur recevra un email avec un mot de passe temporaire.",
  },
  {
    q: "Comment réinitialiser mon mot de passe ?",
    a: "Sur la page de connexion, cliquez sur « Mot de passe oublié » et saisissez votre adresse email. Vous recevrez un lien de réinitialisation valable 24 heures. Si vous ne recevez pas l'email, vérifiez votre dossier de courriers indésirables.",
  },
  {
    q: "Comment changer mon adresse email ?",
    a: "Allez dans Mon compte > Profil, puis modifiez le champ « Email ». Un email de confirmation sera envoyé à la nouvelle adresse. Le changement ne sera effectif qu'après validation du lien reçu.",
  },
  {
    q: "Que se passe-t-il si mon compte est verrouillé ?",
    a: "Après 5 tentatives de connexion échouées, votre compte est automatiquement verrouillé pendant 15 minutes par mesure de sécurité. Attendez la fin du délai puis réessayez avec le bon mot de passe. Si le problème persiste, utilisez la fonction « Mot de passe oublié ».",
  },
  {
    q: "Comment activer la double authentification (2FA) ?",
    a: "Allez dans Mon compte > Sécurité > Authentification à deux facteurs, puis cliquez sur « Activer ». Scannez le QR code avec une application d'authentification (Google Authenticator, Authy, etc.) et saisissez le code à 6 chiffres pour confirmer. Conservez précieusement vos codes de récupération.",
  },
  // ── Abonnement et facturation MyGestia ──
  {
    q: "L'essai gratuit est-il sans engagement ?",
    a: "Oui, l'essai de 14 jours est entièrement gratuit et sans carte bancaire. À la fin de la période, votre compte passe en lecture seule. Vous pouvez souscrire à tout moment pour retrouver l'accès complet.",
  },
  {
    q: "Quelles sont les différences entre les plans Starter, Pro et Enterprise ?",
    a: "Le plan Starter permet jusqu'à 20 lots, 1 société et 2 utilisateurs. Le Pro monte à 50 lots, 3 sociétés et 5 utilisateurs. L'Enterprise est sans limite et inclut la signature électronique, l'import IA et l'accès API.",
  },
  {
    q: "Comment changer de plan (Starter / Pro / Enterprise) ?",
    a: "Allez dans Mon compte > Abonnement, puis cliquez sur « Changer de plan ». Sélectionnez le nouveau plan souhaité et validez le paiement. Le changement est effectif immédiatement et la différence de tarif est calculée au prorata.",
  },
  {
    q: "Comment annuler mon abonnement ?",
    a: "Allez dans Mon compte > Abonnement > Annuler l'abonnement. Votre accès reste actif jusqu'à la fin de la période de facturation en cours. Après cette date, votre compte passe en lecture seule mais vos données sont conservées.",
  },
  {
    q: "Que se passe-t-il à la fin de l'essai gratuit ?",
    a: "Si vous ne souscrivez pas à un plan payant avant la fin des 14 jours, votre compte passe automatiquement en lecture seule. Vous pouvez toujours consulter vos données, mais les créations et modifications sont désactivées. Souscrivez à tout moment pour retrouver l'accès complet.",
  },
  {
    q: "Mes données sont-elles supprimées si j'annule mon abonnement ?",
    a: "Non, vos données ne sont jamais supprimées automatiquement lors d'une annulation. Votre compte passe en lecture seule et vos données restent disponibles. Vous pouvez les exporter à tout moment via les boutons d'export CSV présents sur chaque module.",
  },
  // ── Patrimoine ──
  {
    q: "Comment modifier les informations d'un immeuble ?",
    a: "Allez dans Patrimoine > Immeubles, puis cliquez sur l'immeuble concerné. Utilisez le bouton « Modifier » pour mettre à jour l'adresse, la surface, le nombre d'étages ou toute autre information. Les modifications sont enregistrées et tracées dans l'historique d'audit.",
  },
  {
    q: "Comment gérer les diagnostics obligatoires ?",
    a: "Dans la fiche d'un immeuble ou d'un lot, rendez-vous dans l'onglet « Diagnostics ». Vous pouvez y ajouter tous les diagnostics (DPE, amiante, plomb, gaz, électricité, etc.) avec leur date de réalisation et d'expiration. L'application vous alerte automatiquement avant l'échéance.",
  },
  {
    q: "Comment suivre les maintenances et travaux ?",
    a: "Depuis la fiche d'un immeuble, accédez à l'onglet « Maintenances » pour créer un suivi de travaux. Indiquez la nature, le prestataire, le coût et les dates. Vous pouvez également générer un rapport de suivi des travaux dans le module Rapports.",
  },
  {
    q: "Un lot peut-il avoir plusieurs baux en même temps ?",
    a: "Non, chaque lot ne peut avoir qu'un seul bail actif à la fois. Pour créer un nouveau bail sur un lot, vous devez d'abord résilier le bail en cours. L'historique de tous les baux passés reste consultable dans la fiche du lot.",
  },
  {
    q: "Puis-je gérer plusieurs sociétés et propriétaires ?",
    a: "Oui, selon votre plan. Le plan Starter permet 1 société, le Pro jusqu'à 3, et l'Enterprise un nombre illimité. Chaque société est rattachée à un propriétaire. La vue Propriétaire consolide les données de l'ensemble.",
  },
  // ── Baux et locataires ──
  {
    q: "Comment résilier un bail ?",
    a: "Allez dans Baux, ouvrez le bail concerné et cliquez sur « Résilier le bail ». Indiquez la date de résiliation et le motif. Attention : un bail résilié ne peut pas être réactivé. Si le locataire revient, il faudra créer un nouveau bail.",
  },
  {
    q: "Comment renouveler un bail ?",
    a: "Pour renouveler un bail arrivé à échéance, résiliez d'abord le bail en cours, puis créez un nouveau bail sur le même lot avec le même locataire. Les nouvelles conditions (loyer révisé, durée, etc.) seront celles du nouveau bail.",
  },
  {
    q: "Comment ajouter un avenant au bail ?",
    a: "Ouvrez le bail concerné dans Baux, puis utilisez le bouton « Ajouter un avenant ». L'avenant permet de modifier des clauses spécifiques (loyer, charges, occupation) sans résilier le bail. Le document est stocké automatiquement dans les pièces jointes du bail.",
  },
  {
    q: "Comment archiver un locataire ?",
    a: "Dans Locataires, cliquez sur le locataire concerné puis sur « Archiver ». Le locataire disparaît des listes actives mais ses données sont conservées conformément aux obligations légales (5 ans après la fin du bail). Vous pouvez consulter les locataires archivés via le filtre dédié.",
  },
  {
    q: "Comment gérer un bail commercial 3/6/9 ?",
    a: "Lors de la création du bail, sélectionnez le type « Commercial ». Renseignez la durée totale (9 ans) et les périodes triennales. L'application gère automatiquement les révisions de loyer avec l'indice ILC ou ILAT et vous alerte avant chaque échéance triennale.",
  },
  {
    q: "Comment sont calculées les révisions de loyer ?",
    a: "Les révisions utilisent les indices IRL, ILC, ILAT ou ICC publiés par l'INSEE, synchronisés automatiquement chaque trimestre. Le calcul applique la formule légale : nouveau loyer = ancien loyer × (nouvel indice / ancien indice).",
  },
  // ── Facturation et paiements ──
  {
    q: "Comment générer une quittance de loyer ?",
    a: "Allez dans Facturation, sélectionnez une facture payée, puis cliquez sur « Générer la quittance ». Le PDF est généré automatiquement et peut être envoyé par email au locataire.",
  },
  {
    q: "Comment créer une facture manuellement ?",
    a: "Allez dans Facturation > Créer une facture. Sélectionnez le bail, la période et le montant, puis validez. La facture est créée en brouillon. Vous pouvez la modifier avant de la valider définitivement et de l'envoyer au locataire.",
  },
  {
    q: "Comment annuler une facture déjà validée ?",
    a: "Une facture validée ne peut pas être supprimée pour des raisons comptables. Vous devez créer un avoir (facture d'annulation) qui viendra compenser la facture initiale. Allez dans la facture concernée et cliquez sur « Générer un avoir ».",
  },
  {
    q: "Comment gérer un paiement partiel ?",
    a: "Lors de l'enregistrement d'un paiement dans Facturation, saisissez le montant effectivement reçu même s'il est inférieur au total de la facture. La facture passera en statut « Partiellement payée » et le solde restant restera visible pour le suivi.",
  },
  {
    q: "Comment envoyer une facture par email ?",
    a: "Ouvrez la facture dans Facturation, puis cliquez sur le bouton « Envoyer par email ». Le locataire recevra la facture en pièce jointe au format PDF. L'envoi est tracé dans l'historique de la facture.",
  },
  {
    q: "Comment régulariser les charges annuelles ?",
    a: "Allez dans Charges > Régularisation. Sélectionnez l'immeuble et la période concernée. L'application compare les provisions versées par chaque locataire aux charges réelles et calcule automatiquement le trop-perçu ou le complément à réclamer.",
  },
  // ── Banque et comptabilité ──
  {
    q: "Comment connecter mon compte bancaire ?",
    a: "Allez dans Banque > Connexion bancaire. L'intégration Open Banking (via Powens ou GoCardless) synchronise automatiquement vos transactions. Vous pouvez aussi ajouter des transactions manuellement.",
  },
  {
    q: "Comment rapprocher mes transactions bancaires ?",
    a: "Allez dans Banque > Rapprochement. L'application suggère automatiquement des correspondances entre vos transactions bancaires et vos factures. Validez ou ajustez chaque proposition, puis confirmez le rapprochement. Les transactions non rapprochées restent en attente.",
  },
  {
    q: "Comment exporter le FEC pour mon comptable ?",
    a: "Allez dans Comptabilité > Export FEC. Sélectionnez l'exercice comptable concerné, puis cliquez sur « Générer le FEC ». Le fichier au format réglementaire (Fichier des Écritures Comptables) est téléchargé et peut être transmis directement à votre expert-comptable.",
  },
  {
    q: "Comment créer un exercice comptable ?",
    a: "Allez dans Comptabilité > Exercices, puis cliquez sur « Nouvel exercice ». Définissez les dates de début et de fin (généralement du 1er janvier au 31 décembre). L'exercice précédent doit être clôturé avant de pouvoir en créer un nouveau.",
  },
  {
    q: "Ma banque n'apparaît pas dans la connexion bancaire, que faire ?",
    a: "L'intégration Open Banking couvre la majorité des banques françaises et européennes. Si votre banque n'apparaît pas, vous pouvez ajouter vos transactions manuellement ou via import CSV. Contactez le support à contact@mygestia.immo pour demander l'ajout de votre établissement.",
  },
  // ── Documents et signatures ──
  {
    q: "Quels formats de fichiers sont acceptés ?",
    a: "L'application accepte les formats PDF, JPG, PNG et WEBP pour les documents. La taille maximale par fichier est de 20 Mo. Les documents sont stockés de manière sécurisée dans un espace de stockage chiffré en Europe.",
  },
  {
    q: "Comment partager des documents via la Dataroom ?",
    a: "Allez dans Documents > Dataroom. Créez un espace de partage, sélectionnez les documents à inclure et générez un lien sécurisé. Ce lien peut être envoyé à un tiers (acquéreur, notaire, comptable) avec une date d'expiration configurable.",
  },
  {
    q: "Comment fonctionne la signature électronique ?",
    a: "La signature électronique est disponible avec le plan Enterprise. Allez dans le document à signer, cliquez sur « Envoyer en signature » et renseignez les signataires. Chaque partie reçoit un email avec un lien sécurisé pour signer le document.",
  },
  // ── Portail locataire ──
  {
    q: "Comment activer le portail pour un locataire ?",
    a: "Allez dans Locataires, ouvrez la fiche du locataire et cliquez sur « Activer le portail ». Un email d'invitation est envoyé automatiquement au locataire avec un lien d'accès sécurisé à son espace personnel.",
  },
  {
    q: "Que peut faire le locataire sur son portail ?",
    a: "Le locataire peut consulter ses quittances et factures, télécharger ses documents (bail, courriers), suivre l'état de ses charges, mettre à jour son attestation d'assurance et créer des tickets de demande (maintenance, question, etc.).",
  },
  {
    q: "Le locataire a-t-il besoin d'un mot de passe ?",
    a: "Non, le portail locataire fonctionne avec une authentification par lien sécurisé (token JWT). Le locataire saisit son email, reçoit un lien de connexion valable 24 heures, et accède directement à son espace sans créer de mot de passe.",
  },
  // ── Courriers ──
  {
    q: "Comment envoyer un courrier à tous les locataires d'un immeuble ?",
    a: "Dans Courriers, sélectionnez un modèle puis choisissez le mode « Envoi par immeuble ». Chaque locataire reçoit un courrier personnalisé (nom, adresse, montant du loyer) et le document est automatiquement enregistré dans son espace portail.",
  },
  {
    q: "Comment envoyer un courrier personnalisé ?",
    a: "Allez dans Courriers > Nouveau courrier. Sélectionnez un modèle ou rédigez votre texte librement, puis choisissez le ou les destinataires. Les variables dynamiques (nom, adresse, loyer) sont remplacées automatiquement. Le courrier peut être envoyé par email ou généré en PDF.",
  },
  {
    q: "Puis-je créer mes propres modèles de courrier ?",
    a: "Oui, allez dans Courriers > Modèles > Créer un modèle. Utilisez les variables disponibles (nom du locataire, adresse du lot, montant du loyer, etc.) pour créer des courriers types réutilisables. Vos modèles sont propres à votre société.",
  },
  // ── Import et export ──
  {
    q: "Puis-je importer mes données depuis un autre logiciel ?",
    a: "Oui, l'onglet Administration > Import permet d'importer des locataires, immeubles, lots et baux depuis un fichier CSV ou Excel. Un assistant vous guide dans le mappage des colonnes.",
  },
  {
    q: "Comment exporter mes données en CSV ?",
    a: "Chaque page de données (locataires, baux, factures, charges, contacts, transactions) dispose d'un bouton d'export en haut à droite. Le fichier CSV est compatible avec Excel (format français, séparateur point-virgule).",
  },
  // ── Rapports ──
  {
    q: "Quels rapports puis-je générer ?",
    a: "9 types de rapports sont disponibles : balance âgée, compte-rendu de gestion, état des impayés, rentabilité par lot, récap charges locataire, situation locative, suivi mensuel, suivi travaux et vacance locative. Vous pouvez aussi planifier des envois automatiques.",
  },
  // ── Sécurité et RGPD ──
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Les données bancaires sont chiffrées en AES-256-GCM, les mots de passe sont hachés avec bcrypt, et l'application utilise HTTPS avec des en-têtes de sécurité stricts. L'hébergement est en Europe.",
  },
  {
    q: "Que couvre la conformité RGPD ?",
    a: "La section RGPD permet de consulter, exporter et supprimer les données personnelles des locataires. Les durées de conservation légales sont respectées automatiquement et un registre des traitements est accessible.",
  },
  // ── Technique et dépannage ──
  {
    q: "L'application est lente, que faire ?",
    a: "Vérifiez d'abord votre connexion internet. Essayez de vider le cache de votre navigateur (Ctrl+Shift+Suppr) et de recharger la page. Si le problème persiste, essayez un autre navigateur (Chrome, Firefox, Edge). En cas de lenteur persistante, contactez le support.",
  },
  {
    q: "Je ne reçois pas les emails de l'application",
    a: "Vérifiez votre dossier de courriers indésirables (spam). Ajoutez contact@mygestia.immo et noreply@mygestia.immo à vos contacts ou à votre liste blanche. Si le problème persiste, vérifiez que votre adresse email est correcte dans Mon compte > Profil.",
  },
  {
    q: "Comment exporter toutes mes données ?",
    a: "Chaque module dispose d'un bouton d'export CSV. Pour un export complet, vous pouvez également utiliser la section RGPD > Export des données qui génère une archive contenant l'ensemble de vos informations dans un format structuré et lisible.",
  },
  // ── Candidatures ──
  {
    q: "Comment fonctionne le pipeline de candidatures ?",
    a: "Le module Candidatures gère vos candidats locataires en 7 étapes : Nouveau → Contacté → Visite planifiée → Visite effectuée → Dossier reçu → Dossier validé → Accepté. Exemple : vous recevez un dossier pour un T3 à Lyon, vous le passez en « Visite planifiée », puis après la visite vous le faites avancer jusqu'à « Accepté ». Un score moyen est calculé pour prioriser les meilleurs profils.",
  },
  {
    q: "Comment noter et comparer les candidatures ?",
    a: "Chaque candidature peut recevoir un score (sur 10 ou 100 selon votre configuration). Le tableau de bord Candidatures affiche le score moyen de tous les candidats actifs et les trie du meilleur au moins bon. Exemple : Jean Dupont obtient 85/100 (CDI, revenus 3× le loyer), Marie Martin 72/100 (CDD, garant solide).",
  },
  // ── Location saisonnière ──
  {
    q: "Comment gérer une location saisonnière (Airbnb, gîte) ?",
    a: "Allez dans Saisonnier > Nouveau bien. Renseignez le type (appartement, maison, villa, studio, gîte, chalet), le tarif par nuitée et les disponibilités. L'application calcule automatiquement le revenu total, le revenu net par réservation et le nombre de nuitées réservées sur l'année.",
  },
  {
    q: "Comment suivre les revenus de mes locations saisonnières ?",
    a: "La page Saisonnier affiche pour chaque bien : le tarif/nuit, le nombre de réservations actives, les nuitées totales et le revenu cumulé depuis le 1er janvier. Les réservations annulées ou no-show sont automatiquement exclues du calcul.",
  },
  // ── Copropriété ──
  {
    q: "Comment gérer une copropriété dans MyGestia ?",
    a: "Allez dans Copropriété > Nouvelle copropriété. Renseignez l'immeuble, les tantièmes de chaque lot et le budget prévisionnel annuel. Vous pourrez ensuite planifier les assemblées générales (AG) et suivre les appels de fonds par copropriétaire.",
  },
  {
    q: "Comment préparer une assemblée générale de copropriété ?",
    a: "Depuis la fiche copropriété, créez une nouvelle AG avec l'ordre du jour, la date et le lieu. Chaque résolution peut être votée et le procès-verbal est généré automatiquement avec les résultats par tantièmes.",
  },
  // ── Courriers et relances ──
  {
    q: "Comment créer un courrier à partir d'un modèle ?",
    a: "Allez dans Courriers, choisissez un modèle par catégorie (loyer, bail, charges, travaux, assurance, administratif). Les variables dynamiques ({nom_locataire}, {adresse_lot}, {montant_loyer}) sont remplacées automatiquement. Exemple : le modèle « Relance loyer impayé » insère le nom du locataire, le montant dû et la date d'échéance.",
  },
  {
    q: "Puis-je générer un courrier avec l'IA ?",
    a: "Oui (plan Enterprise). L'assistant IA rédige des courriers immobiliers sur mesure : relances, mises en demeure, résiliations, demandes d'attestation. Indiquez le sujet et le ton souhaité, l'IA génère un courrier conforme avec les références légales appropriées.",
  },
  // ── Workflows et automatisation ──
  {
    q: "Comment créer un workflow automatisé ?",
    a: "Allez dans Workflows > Nouveau workflow. Choisissez un déclencheur (événement, planification ou manuel), puis ajoutez des étapes : envoi d'email, notification, génération de PDF, délai d'attente, changement de statut, condition, webhook. Exemple : « Quand une facture passe en retard → attendre 3 jours → envoyer email de relance niveau 1 → attendre 14 jours → envoyer relance niveau 2 ».",
  },
  {
    q: "Comment suivre l'exécution de mes workflows ?",
    a: "Chaque workflow affiche son historique d'exécution (les 3 dernières exécutions avec leur statut : succès, échec, en cours). Vous pouvez activer/désactiver un workflow à tout moment et voir le nombre total d'exécutions.",
  },
  // ── Assistant IA ──
  {
    q: "Que peut faire l'assistant IA ?",
    a: "L'assistant IA (plan Enterprise, menu Assistant) offre 3 fonctionnalités : (1) Chatbot contextuel — posez des questions en langage naturel sur vos locataires, impayés ou revenus. Exemple : « Quels sont mes locataires en retard de plus de 30 jours ? ». (2) Générateur de courriers — rédaction automatique de lettres conformes. (3) Prédiction d'impayés — analyse du comportement de paiement sur 12 mois avec score de risque, probabilité de défaut et recommandations.",
  },
  // ── Import de données ──
  {
    q: "Comment importer mes données depuis un fichier Excel ou un autre logiciel ?",
    a: "Allez dans Import (ou Administration > Import). L'assistant d'import en plusieurs étapes vous guide : (1) uploadez votre fichier CSV/Excel ou PDF, (2) l'application détecte et mappe les colonnes automatiquement, (3) vérifiez et corrigez les correspondances, (4) validez l'import. Vous pouvez importer des immeubles, lots, locataires et baux en une seule opération. L'import IA (Enterprise) peut aussi extraire les données directement depuis un PDF de bail.",
  },
  // ── Indices INSEE ──
  {
    q: "Comment fonctionnent les indices INSEE (IRL, ILC, ILAT, ICC) ?",
    a: "Le module Indices suit 4 indices : IRL (habitation, publié ~45 jours après le trimestre), ILC (commercial), ILAT (tertiaire) et ICC (construction, publiés ~90 jours après). Les indices sont synchronisés automatiquement le 1er de chaque mois. Exemple : l'IRL du T4 2025 est publié vers mi-janvier 2026 par l'INSEE. L'application calcule automatiquement les révisions de loyer dues à partir de ces indices.",
  },
  // ── Tickets ──
  {
    q: "Comment fonctionnent les tickets de maintenance ?",
    a: "Le module Tickets permet de suivre les demandes d'intervention. Chaque ticket a un statut (Ouvert, En cours, En attente, Résolu, Fermé), une priorité (Basse, Normale, Haute, Urgente) et une catégorie (Plomberie, Électricité, Chauffage, Parties communes, etc.). Les locataires peuvent aussi créer des tickets depuis leur portail. Exemple : un locataire signale une fuite → ticket « Urgente / Plomberie » → vous assignez un prestataire → statut « En cours » → intervention terminée → « Résolu ».",
  },
  // ── Support ──
  {
    q: "Comment contacter le support ?",
    a: "Envoyez-nous un email à contact@mygestia.immo ou utilisez le formulaire de contact accessible depuis le menu. Les clients Enterprise bénéficient d'un support prioritaire avec un temps de réponse garanti sous 4 heures ouvrées.",
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
          <h1 className="text-3xl font-bold mb-3">Centre d'aide</h1>
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
          <h2 className="text-xl font-bold mb-2">Besoin d'aide supplémentaire ?</h2>
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
