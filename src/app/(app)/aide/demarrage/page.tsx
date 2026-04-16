import { Building2 } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Démarrage rapide | Centre d'aide | ${APP_NAME}`,
};

export default function DemarragePage() {
  return (
    <HelpPageLayout
      slug="demarrage"
      icon={<Building2 className="h-6 w-6" />}
      title="Démarrage rapide"
      description="Créez votre société, ajoutez vos immeubles et lots, et commencez à gérer votre patrimoine en quelques minutes."
    >
      <HelpSection id="essai-gratuit" title="Essai gratuit de 14 jours">
        <p>
          À votre première connexion, vous bénéficiez automatiquement d'un essai gratuit de 14 jours, sans carte bancaire requise. Pendant cette période, toutes les fonctionnalités sont accessibles (équivalent du plan Enterprise). Une bannière vous indique le nombre de jours restants.
        </p>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous créez votre compte le 1er avril. Jusqu'au 15 avril, vous avez accès à tout : import IA, assistant chatbot, signature électronique. Le 10 avril, une bannière orange apparaît &laquo; Il vous reste 5 jours d'essai &raquo;. Si vous ne souscrivez pas avant le 15, votre compte passe en lecture seule — vos données sont conservées.
          </p>
        </div>
        <InfoBox type="tip">
          Vous pouvez souscrire un abonnement à tout moment depuis <strong>Mon compte &gt; Abonnement</strong>. Vos données sont conservées intégralement lors du passage à un plan payant.
        </InfoBox>
      </HelpSection>

      <HelpSection id="creer-societe" title="Créer votre première société">
        <p>
          La société est l'entité centrale de {APP_NAME}. Tous vos immeubles, locataires, factures et documents sont rattachés à une société. Vous pouvez gérer plusieurs sociétés (SCI, SARL, personne physique, etc.) selon votre plan.
        </p>
        <HelpStep number={1} title="Accédez à la création">
          <p>Cliquez sur le bouton <strong>Nouvelle société</strong> depuis la barre de navigation (sélecteur de société en haut) ou depuis la page Sociétés.</p>
        </HelpStep>
        <HelpStep number={2} title="Renseignez les informations obligatoires">
          <p>Remplissez le formulaire : nom de la société, forme juridique (SCI, SARL, SAS, EURL, personne physique...), numéro SIRET (14 chiffres), adresse du siège social. Les champs marqués d'un astérisque (*) sont obligatoires.</p>
        </HelpStep>
        <HelpStep number={3} title="Ajoutez votre logo (optionnel)">
          <p>Uploadez le logo de votre société (formats acceptés : PNG, JPG, WEBP, max 20 Mo). Il apparaîtra automatiquement sur vos factures, quittances, courriers et rapports PDF.</p>
        </HelpStep>
        <HelpStep number={4} title="Configurez votre compte bancaire">
          <p>Renseignez l'IBAN et le BIC de votre compte principal. Ces informations sont chiffrées en AES-256-GCM et apparaîtront sur vos factures et mandats SEPA.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous créez la SCI Soleil, SIRET 123 456 789 01234, siège au 12 rue de la Paix, 75001 Paris. Vous uploadez votre logo et renseignez l'IBAN FR76 3000 6000 0112 3456 7890 189. Votre société est prête — vous pouvez maintenant ajouter des immeubles.
          </p>
        </div>
        <InfoBox type="info">
          Un <strong>propriétaire</strong> est automatiquement créé lors de la première société. C'est l'entité qui chapeaute une ou plusieurs sociétés (voir le guide Vue Propriétaire).
        </InfoBox>
      </HelpSection>

      <HelpSection id="premier-immeuble" title="Ajouter votre premier immeuble">
        <p>
          Un immeuble représente un bâtiment physique dans votre patrimoine. Il contient un ou plusieurs lots (appartements, locaux commerciaux, parkings, etc.).
        </p>
        <HelpStep number={1} title="Menu Patrimoine > Nouveau">
          <p>Depuis la barre de navigation, cliquez sur <strong>Patrimoine</strong> puis sur le bouton <strong>Nouvel immeuble</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Informations de l'immeuble">
          <p>Renseignez le nom (ex: &laquo; Résidence les Acacias &raquo;), l'adresse complète, le type (habitation, bureau, commerce, mixte), l'année de construction et la surface totale en m².</p>
        </HelpStep>
        <HelpStep number={3} title="Ajoutez des lots">
          <p>Depuis la fiche immeuble, cliquez sur <strong>Ajouter un lot</strong>. Renseignez pour chaque lot : le numéro ou identifiant (ex: &laquo; Apt 3B &raquo;), le type (habitation, meublé, commercial, parking, cave...), l'étage, la surface en m² et le loyer de référence.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous ajoutez la &laquo; Résidence les Acacias &raquo; au 45 avenue Victor Hugo, 69006 Lyon, type Habitation, 1975, 450 m². Puis vous créez 3 lots : Apt 1A (T2, RDC, 45 m², 650 &euro;/mois), Apt 2B (T3, 1er étage, 72 m², 950 &euro;/mois), Parking P01 (sous-sol, 15 m², 80 &euro;/mois).
          </p>
        </div>
        <InfoBox type="info">
          Vous pouvez également importer vos données depuis un fichier Excel ou CSV via le module <strong>Import</strong> (Administration &gt; Import). Voir la section ci-dessous.
        </InfoBox>
      </HelpSection>

      <HelpSection id="premier-locataire" title="Enregistrer un locataire et créer un bail">
        <HelpStep number={1} title="Créez le locataire">
          <p>Allez dans <strong>Locataires &gt; Nouveau locataire</strong>. Renseignez son identité (personne physique : nom, prénom, date de naissance ; personne morale : raison sociale, SIRET), ses coordonnées (email, téléphone) et son adresse actuelle.</p>
        </HelpStep>
        <HelpStep number={2} title="Créez le bail">
          <p>Allez dans <strong>Baux &gt; Nouveau bail</strong>. Sélectionnez le locataire et le lot concerné, puis renseignez les conditions : type de bail (habitation nue, meublé, commercial 3/6/9, professionnel...), loyer mensuel HT, charges provisionnelles, dépôt de garantie, dates de début et fin.</p>
        </HelpStep>
        <HelpStep number={3} title="Configurez la révision de loyer">
          <p>Si le bail est indexé, sélectionnez l'indice applicable (IRL pour l'habitation, ILC pour le commerce, ILAT pour les bureaux), le trimestre de référence et la fréquence de révision (annuelle). Les révisions seront calculées automatiquement à chaque échéance.</p>
        </HelpStep>
        <HelpStep number={4} title="Générez la première facture">
          <p>La facturation est automatique : chaque jour à 7h, un brouillon de facture est généré pour les baux actifs. Vérifiez-le dans Facturation &gt; Brouillons, validez-le puis envoyez-le par email en un clic.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous créez le locataire Jean Dupont (jean.dupont@email.com, 06 12 34 56 78). Puis vous créez un bail habitation sur l'Apt 2B : loyer 950 &euro;/mois HT, charges 80 &euro;/mois, dépôt de garantie 950 &euro;, du 01/04/2026 au 31/03/2029, indexé IRL T1. Le lendemain matin, un brouillon de facture &laquo; FAC-2026-0001 &raquo; de 1 030 &euro; apparaît dans Facturation.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="import" title="Importer vos données existantes">
        <p>
          Si vous avez déjà un patrimoine géré ailleurs (Excel, autre logiciel, PDF de baux), le module Import vous permet de migrer rapidement vos données.
        </p>
        <HelpStep number={1} title="Accédez au module Import">
          <p>Allez dans <strong>Import</strong> depuis le menu Modules, ou dans <strong>Administration &gt; Import</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Choisissez votre source">
          <p>Uploadez un fichier CSV, Excel (.xlsx) ou PDF. L'assistant détecte automatiquement les colonnes et propose un mappage vers les champs de {APP_NAME}.</p>
        </HelpStep>
        <HelpStep number={3} title="Vérifiez et validez">
          <p>Vérifiez la correspondance des colonnes, corrigez si nécessaire, puis lancez l'import. Les immeubles, lots, locataires et baux sont créés automatiquement.</p>
        </HelpStep>
        <InfoBox type="tip">
          <strong>Import IA (Enterprise) :</strong> Uploadez directement un PDF de bail — l'IA extrait automatiquement les informations (locataire, lot, loyer, dates) et pré-remplit le formulaire de création.
        </InfoBox>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous avez un fichier Excel avec 15 locataires et 20 lots. Uploadez-le dans Import : l'application détecte les colonnes &laquo; Nom &raquo;, &laquo; Prénom &raquo;, &laquo; Adresse lot &raquo;, &laquo; Loyer &raquo;. Validez le mappage, cliquez sur Importer — en quelques secondes, vos 15 locataires et 20 lots sont créés avec les baux associés.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="navigation" title="Naviguer dans l'application">
        <p>
          {APP_NAME} utilise une barre de navigation horizontale en haut de l'écran (sur desktop) et un menu hamburger glissant (sur mobile/tablette).
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Barre de navigation (desktop)</p>
            <p>La barre affiche les liens directs vers les modules principaux et deux menus déroulants : <strong>Gestion locative</strong> (Baux, Locataires, Charges, Candidatures, Courriers, Relances, Indices) et <strong>Modules</strong> (Saisonnier, Copropriété, Workflows, Assistant IA, Import, Tickets, Documents). Le sélecteur de propriétaire et de société est à gauche.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Recherche globale (Ctrl+K)</p>
            <p>Tapez <strong>Ctrl+K</strong> (ou Cmd+K sur Mac) pour ouvrir la recherche globale. Trouvez instantanément un locataire, un immeuble, un bail ou un document par son nom.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Sélecteur de société</p>
            <p>En haut de la barre de navigation, le sélecteur permet de basculer entre vos sociétés. Toutes les données affichées sont automatiquement filtrées par la société active.</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="checklist" title="Checklist de démarrage">
        <div className="rounded-lg border p-5 bg-muted/20">
          <ul className="space-y-3">
            {[
              "Créer votre société (nom, forme juridique, SIRET)",
              "Renseigner votre IBAN/BIC pour les factures",
              "Uploader votre logo (optionnel mais recommandé)",
              "Ajouter votre premier immeuble",
              "Créer les lots de cet immeuble (ou importer depuis Excel)",
              "Enregistrer vos locataires",
              "Créer les baux actifs avec les conditions de loyer",
              "Vérifier la génération automatique des factures (lendemain 7h)",
              "Inviter vos collaborateurs (Mon compte > Utilisateurs)",
              "Configurer les relances automatiques si souhaité",
              "Activer la double authentification (2FA) pour la sécurité",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 rounded border-2 border-muted-foreground/30 shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur le démarrage">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Combien de temps dure l'essai gratuit ?</p>
            <p>14 jours, sans carte bancaire. Toutes les fonctionnalités Enterprise sont accessibles. Après l'essai, votre compte passe en lecture seule — souscrivez à tout moment pour retrouver l'accès complet.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je importer mes données depuis un autre logiciel ?</p>
            <p>Oui, via <strong>Administration &gt; Import</strong>. Formats acceptés : CSV, Excel (.xlsx) et PDF (Enterprise). Un assistant de mappage vous guide pour faire correspondre vos colonnes. Exemple : colonne &laquo; Loyer mensuel &raquo; → champ &laquo; Loyer HT &raquo;.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Faut-il créer la société avant les immeubles ?</p>
            <p>Oui, la société est l'entité racine. L'ordre recommandé est : Société → Immeubles → Lots → Locataires → Baux. Les factures sont ensuite générées automatiquement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je modifier les informations de ma société plus tard ?</p>
            <p>Oui, à tout moment depuis la fiche société (cliquez sur le nom de la société dans le sélecteur, puis Modifier). Toute modification est tracée dans l'historique d'audit.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Les factures sont-elles générées automatiquement ?</p>
            <p>Oui. Chaque jour à 7h, {APP_NAME} crée des brouillons de factures pour tous les baux actifs. Il vous suffit de les vérifier dans <strong>Facturation &gt; Brouillons</strong>, puis de les valider et envoyer par email.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment inviter un collaborateur ?</p>
            <p>Allez dans <strong>Mon compte &gt; Utilisateurs &gt; Créer</strong>. Renseignez l'email et choisissez un rôle (Admin, Gestionnaire, Comptable ou Lecture seule). Un email avec un mot de passe temporaire est envoyé automatiquement. Limites par plan : Starter 2 users, Pro 5, Enterprise illimité.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Que se passe-t-il si je dépasse les limites de mon plan ?</p>
            <p>Une alerte s'affiche et la création de nouveaux éléments est bloquée (lots, utilisateurs ou sociétés selon le plan). Exemple : sur le plan Starter (20 lots max), la création du 21e lot affiche &laquo; Limite atteinte — passez au plan Pro &raquo;.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment passer d'un plan gratuit à un plan payant ?</p>
            <p>Allez dans <strong>Mon compte &gt; Abonnement</strong>, choisissez Starter (19 &euro;/mois), Pro (79 &euro;/mois) ou Enterprise (199 &euro;/mois). Le paiement se fait par carte bancaire via Stripe. Vos données sont conservées intégralement lors de la transition.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter mon logo sur les factures ?</p>
            <p>Depuis la fiche de votre société, section Logo, uploadez votre image (PNG, JPG ou WEBP). Le logo apparaîtra automatiquement sur les factures PDF, quittances, courriers et rapports.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je tester toutes les fonctionnalités pendant l'essai ?</p>
            <p>Oui, l'essai gratuit donne accès à l'intégralité des fonctionnalités Enterprise : assistant IA, import intelligent, signature électronique, workflows, API, etc. Aucune restriction pendant 14 jours.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
