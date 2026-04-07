import { Building2 } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

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
          À votre première connexion, vous bénéficiez automatiquement d&apos;un essai gratuit de 14 jours, sans carte bancaire requise. Pendant cette période, toutes les fonctionnalités sont accessibles. Une bannière vous indique le nombre de jours restants.
        </p>
        <ScreenshotPlaceholder alt="Bannière d'essai gratuit" caption="La bannière apparaît en haut de l'écran avec le décompte des jours restants" src="/aide/screenshots/dashboard-main.png" />
        <InfoBox type="tip">
          Vous pouvez souscrire un abonnement à tout moment depuis Mon compte &gt; Abonnement. Vos données sont conservées intégralement lors du passage à un plan payant.
        </InfoBox>
      </HelpSection>

      <HelpSection id="creer-societe" title="Créer votre première société">
        <p>
          La société est l&apos;entité centrale de {APP_NAME}. Tous vos immeubles, locataires, factures et documents sont rattachés à une société. Vous pouvez gérer plusieurs sociétés (SCI, SARL, personne physique, etc.).
        </p>
        <HelpStep number={1} title="Accédez à la création">
          <p>Cliquez sur le bouton <strong>Nouvelle société</strong> depuis le menu principal ou depuis la page Sociétés.</p>
        </HelpStep>
        <HelpStep number={2} title="Renseignez les informations">
          <p>Remplissez le formulaire : nom de la société, forme juridique (SCI, SARL, SAS, personne physique...), SIRET, adresse du siège social. Les champs obligatoires sont marqués d&apos;un astérisque.</p>
        </HelpStep>
        <HelpStep number={3} title="Ajoutez votre logo (optionnel)">
          <p>Uploadez le logo de votre société. Il apparaîtra sur vos factures, quittances et courriers.</p>
        </HelpStep>
        <HelpStep number={4} title="Configurez votre compte bancaire">
          <p>Renseignez l&apos;IBAN et le BIC de votre compte principal. Ces informations sont chiffrées (AES-256) et apparaîtront sur vos factures et mandats SEPA.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Formulaire de création de société" caption="Formulaire avec les champs nom, forme juridique, SIRET et adresse" src="/aide/screenshots/administration-main.png" />
      </HelpSection>

      <HelpSection id="premier-immeuble" title="Ajouter votre premier immeuble">
        <p>
          Un immeuble représente un bâtiment physique dans votre patrimoine. Il contient un ou plusieurs lots (appartements, locaux commerciaux, parkings, etc.).
        </p>
        <HelpStep number={1} title="Menu Patrimoine > Nouveau">
          <p>Depuis le menu latéral, cliquez sur <strong>Patrimoine</strong> puis sur le bouton <strong>Nouvel immeuble</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Informations de l'immeuble">
          <p>Renseignez le nom, l&apos;adresse complète, le type (habitation, bureau, commerce, mixte), l&apos;année de construction et la surface totale.</p>
        </HelpStep>
        <HelpStep number={3} title="Ajoutez des lots">
          <p>Depuis la fiche immeuble, cliquez sur <strong>Ajouter un lot</strong>. Renseignez le numéro, le type, l&apos;étage, la surface et le loyer de référence.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Page de création d'immeuble" caption="Formulaire de saisie des informations d'un immeuble" src="/aide/screenshots/patrimoine-main.png" />
        <InfoBox type="info">
          Vous pouvez également importer vos données depuis un fichier Excel ou CSV via le module Import (Administration &gt; Import).
        </InfoBox>
      </HelpSection>

      <HelpSection id="premier-locataire" title="Enregistrer un locataire et créer un bail">
        <HelpStep number={1} title="Créez le locataire">
          <p>Allez dans <strong>Locataires &gt; Nouveau locataire</strong>. Renseignez son identité (nom, prénom ou raison sociale), ses coordonnées (email, téléphone) et son adresse. Vous pouvez préciser s&apos;il s&apos;agit d&apos;une personne physique ou morale.</p>
        </HelpStep>
        <HelpStep number={2} title="Créez le bail">
          <p>Allez dans <strong>Baux &gt; Nouveau bail</strong>. Sélectionnez le locataire et le lot concerné, puis renseignez les conditions : type de bail (habitation, meublé, commercial 3/6/9...), loyer mensuel, charges, dépôt de garantie, dates de début et fin.</p>
        </HelpStep>
        <HelpStep number={3} title="Configurez la révision de loyer">
          <p>Si le bail est indexé, sélectionnez l&apos;indice (IRL, ILC, ILAT), le trimestre de référence et la fréquence de révision. Les révisions seront calculées automatiquement.</p>
        </HelpStep>
        <HelpStep number={4} title="Générez la première facture">
          <p>La facturation est automatique : chaque mois, un brouillon de facture est généré. Validez-le et envoyez-le par email en un clic.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Création d'un bail" caption="Formulaire de création de bail avec sélection du locataire et du lot" src="/aide/screenshots/baux-main.png" />
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
    </HelpPageLayout>
  );
}
