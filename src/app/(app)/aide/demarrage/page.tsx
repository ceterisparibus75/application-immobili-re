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
          À votre première connexion, vous bénéficiez automatiquement d'un essai gratuit de 14 jours, sans carte bancaire requise. Pendant cette période, toutes les fonctionnalités sont accessibles. Une bannière vous indique le nombre de jours restants.
        </p>
        <InfoBox type="tip">
          Vous pouvez souscrire un abonnement à tout moment depuis Mon compte &gt; Abonnement. Vos données sont conservées intégralement lors du passage à un plan payant.
        </InfoBox>
      </HelpSection>

      <HelpSection id="creer-societe" title="Créer votre première société">
        <p>
          La société est l'entité centrale de {APP_NAME}. Tous vos immeubles, locataires, factures et documents sont rattachés à une société. Vous pouvez gérer plusieurs sociétés (SCI, SARL, personne physique, etc.).
        </p>
        <HelpStep number={1} title="Accédez à la création">
          <p>Cliquez sur le bouton <strong>Nouvelle société</strong> depuis le menu principal ou depuis la page Sociétés.</p>
        </HelpStep>
        <HelpStep number={2} title="Renseignez les informations">
          <p>Remplissez le formulaire : nom de la société, forme juridique (SCI, SARL, SAS, personne physique...), SIRET, adresse du siège social. Les champs obligatoires sont marqués d'un astérisque.</p>
        </HelpStep>
        <HelpStep number={3} title="Ajoutez votre logo (optionnel)">
          <p>Uploadez le logo de votre société. Il apparaîtra sur vos factures, quittances et courriers.</p>
        </HelpStep>
        <HelpStep number={4} title="Configurez votre compte bancaire">
          <p>Renseignez l'IBAN et le BIC de votre compte principal. Ces informations sont chiffrées (AES-256) et apparaîtront sur vos factures et mandats SEPA.</p>
        </HelpStep>
      </HelpSection>

      <HelpSection id="premier-immeuble" title="Ajouter votre premier immeuble">
        <p>
          Un immeuble représente un bâtiment physique dans votre patrimoine. Il contient un ou plusieurs lots (appartements, locaux commerciaux, parkings, etc.).
        </p>
        <HelpStep number={1} title="Menu Patrimoine > Nouveau">
          <p>Depuis le menu latéral, cliquez sur <strong>Patrimoine</strong> puis sur le bouton <strong>Nouvel immeuble</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Informations de l'immeuble">
          <p>Renseignez le nom, l'adresse complète, le type (habitation, bureau, commerce, mixte), l'année de construction et la surface totale.</p>
        </HelpStep>
        <HelpStep number={3} title="Ajoutez des lots">
          <p>Depuis la fiche immeuble, cliquez sur <strong>Ajouter un lot</strong>. Renseignez le numéro, le type, l'étage, la surface et le loyer de référence.</p>
        </HelpStep>
        <InfoBox type="info">
          Vous pouvez également importer vos données depuis un fichier Excel ou CSV via le module Import (Administration &gt; Import).
        </InfoBox>
      </HelpSection>

      <HelpSection id="premier-locataire" title="Enregistrer un locataire et créer un bail">
        <HelpStep number={1} title="Créez le locataire">
          <p>Allez dans <strong>Locataires &gt; Nouveau locataire</strong>. Renseignez son identité (nom, prénom ou raison sociale), ses coordonnées (email, téléphone) et son adresse. Vous pouvez préciser s'il s'agit d'une personne physique ou morale.</p>
        </HelpStep>
        <HelpStep number={2} title="Créez le bail">
          <p>Allez dans <strong>Baux &gt; Nouveau bail</strong>. Sélectionnez le locataire et le lot concerné, puis renseignez les conditions : type de bail (habitation, meublé, commercial 3/6/9...), loyer mensuel, charges, dépôt de garantie, dates de début et fin.</p>
        </HelpStep>
        <HelpStep number={3} title="Configurez la révision de loyer">
          <p>Si le bail est indexé, sélectionnez l'indice (IRL, ILC, ILAT), le trimestre de référence et la fréquence de révision. Les révisions seront calculées automatiquement.</p>
        </HelpStep>
        <HelpStep number={4} title="Générez la première facture">
          <p>La facturation est automatique : chaque mois, un brouillon de facture est généré. Validez-le et envoyez-le par email en un clic.</p>
        </HelpStep>
      </HelpSection>

      <HelpSection id="checklist" title="Checklist de démarrage">
        <div className="rounded-lg border p-5 bg-muted/20">
          <ul className="space-y-3">
            {[
              "Créer votre société (nom, forme juridique, SIRET)",
              "Renseigner votre IBAN/BIC",
              "Ajouter votre premier immeuble",
              "Créer les lots de cet immeuble",
              "Enregistrer vos locataires",
              "Créer les baux actifs",
              "Vérifier la génération automatique des factures",
              "Inviter vos collaborateurs (si applicable)",
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
            <p>L'essai gratuit dure 14 jours, sans carte bancaire requise. Pendant cette période, toutes les fonctionnalités sont accessibles. Une fois l'essai terminé, votre compte passe en lecture seule jusqu'à la souscription d'un abonnement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je importer mes données depuis un autre logiciel ?</p>
            <p>Oui, rendez-vous dans Administration &gt; Import. Vous pouvez importer vos données au format CSV ou Excel. Un assistant de mappage vous guide pour faire correspondre vos colonnes aux champs de l'application.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Faut-il créer la société avant les immeubles ?</p>
            <p>Oui, la société est l'entité centrale de l'application. Tous les immeubles, locataires, baux et factures sont rattachés à une société. Vous devez donc créer votre société en premier.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je modifier les informations de ma société plus tard ?</p>
            <p>Oui, vous pouvez modifier les informations de votre société à tout moment depuis la fiche société en cliquant sur le bouton Modifier.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter mon logo sur les factures ?</p>
            <p>Depuis la fiche de votre société, rendez-vous dans la section Logo et uploadez votre image. Le logo apparaîtra automatiquement sur vos factures, quittances et courriers.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Est-ce que les factures sont générées automatiquement ?</p>
            <p>Oui, chaque jour à 7h, l'application génère automatiquement des brouillons de factures pour tous les baux actifs. Il vous suffit de les vérifier et de les valider avant envoi.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment inviter un collaborateur ?</p>
            <p>Rendez-vous dans Mon compte &gt; Utilisateurs, puis cliquez sur Créer. Renseignez l'adresse email et le rôle souhaité. Un email d'invitation sera envoyé automatiquement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Que se passe-t-il si je dépasse les limites de mon plan ?</p>
            <p>Une alerte s'affiche pour vous prévenir. Vous ne pourrez pas créer de nouveaux éléments (lots, utilisateurs, sociétés) au-delà des limites de votre plan. Passez à un plan supérieur pour débloquer la situation.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment passer d'un plan gratuit à un plan payant ?</p>
            <p>Rendez-vous dans Mon compte &gt; Abonnement, choisissez le plan qui vous convient et procédez au paiement par carte bancaire via Stripe. Vos données sont conservées intégralement lors du passage.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je tester toutes les fonctionnalités pendant l'essai ?</p>
            <p>Oui, l'essai gratuit donne accès à toutes les fonctionnalités du plan Enterprise, sans aucune restriction. Vous pouvez ainsi évaluer l'ensemble des capacités de l'application.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
