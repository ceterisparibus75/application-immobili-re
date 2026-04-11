import { Building2 } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Gestion du patrimoine | Centre d'aide | ${APP_NAME}`,
};

export default function PatrimoinePage() {
  return (
    <HelpPageLayout
      slug="patrimoine"
      icon={<Building2 className="h-6 w-6" />}
      title="Gestion du patrimoine"
      description="Gérez vos immeubles, lots, diagnostics, maintenances et états des lieux depuis un espace centralisé."
    >
      <HelpSection id="vue-ensemble" title="Vue d'ensemble du patrimoine">
        <p>
          La page <strong>Patrimoine</strong> affiche la liste de tous vos immeubles avec des indicateurs clés : nombre de lots, taux d&apos;occupation, revenus annuels et valeur estimée du patrimoine.
        </p>
        <p>
          Chaque immeuble est présenté sous forme de carte avec un badge de type (habitation, bureau, commerce, mixte), le nombre de lots occupés sur le total, le revenu locatif annuel et le rendement brut (en vert si &ge; 5%, orange si 3-5%, rouge si &lt; 3%).
        </p>
        <ScreenshotPlaceholder alt="Liste des immeubles" caption="Vue principale du patrimoine avec les KPI et la liste des immeubles" src="/aide/screenshots/patrimoine-main.png" />
        <InfoBox type="tip">
          Un indicateur d&apos;alerte s&apos;affiche si un bail expire dans les 90 prochains jours sur l&apos;un de vos immeubles.
        </InfoBox>
      </HelpSection>

      <HelpSection id="fiche-immeuble" title="Fiche immeuble détaillée">
        <p>
          En cliquant sur un immeuble, vous accédez à sa fiche complète organisée en plusieurs sections :
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Informations générales</p>
            <p>Nom, adresse complète, type de bien, année de construction, surface totale, nombre de lots. Vous pouvez modifier ces informations via le bouton Modifier en haut de page.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Valorisation</p>
            <p>Valeur de marché, valeur nette comptable. Le bouton <strong>Évaluation IA</strong> lance une estimation automatique basée sur les données du marché immobilier.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Liste des lots</p>
            <p>Tableau de tous les lots avec numéro, type, étage, surface, statut (vacant, occupé, en travaux) et loyer actuel. Ajoutez un lot directement depuis cette section.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Diagnostics</p>
            <p>Liste de tous les diagnostics obligatoires (DPE, amiante, plomb, gaz, électricité, etc.) avec la date de réalisation, le résultat et la date d&apos;expiration. Un code couleur indique les diagnostics expirés (rouge) ou expirant bientôt (orange).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Interventions techniques</p>
            <p>Historique des maintenances et interventions avec titre, date planifiée, coût et statut d&apos;avancement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Documents</p>
            <p>Tous les documents rattachés à l&apos;immeuble, classés par catégorie avec alerte d&apos;expiration pour les documents à durée limitée.</p>
          </div>
        </div>
        <ScreenshotPlaceholder alt="Fiche immeuble détaillée" caption="Vue complète d'un immeuble avec lots, diagnostics et interventions" src="/aide/screenshots/patrimoine-detail.png" />
      </HelpSection>

      <HelpSection id="lots" title="Gestion des lots">
        <p>
          Un lot représente une unité locative au sein d&apos;un immeuble : appartement, local commercial, parking, cave, etc.
        </p>
        <HelpStep number={1} title="Créer un lot">
          <p>Depuis la fiche immeuble, cliquez sur <strong>Ajouter un lot</strong>. Renseignez le numéro/identifiant, le type de lot, l&apos;étage, la surface en m² et le loyer de référence.</p>
        </HelpStep>
        <HelpStep number={2} title="Types de lots disponibles">
          <p>Habitation, meublé, commercial, bureau, parking, cave, entrepôt, terrain, mixte et autre. Le type influence les options de bail disponibles.</p>
        </HelpStep>
        <HelpStep number={3} title="Statuts d'un lot">
          <p>Un lot peut être <strong>Vacant</strong> (disponible à la location), <strong>Occupé</strong> (bail actif), <strong>En travaux</strong> (indisponible temporairement) ou <strong>Réservé</strong> (bail en préparation).</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Liste des lots d'un immeuble" caption="Tableau des lots avec statut, surface, loyer et locataire" src="/aide/screenshots/patrimoine-detail.png" />
        <InfoBox type="info">
          Un lot ne peut avoir qu&apos;un seul bail actif à la fois. Pour changer de locataire, il faut d&apos;abord résilier le bail en cours, puis en créer un nouveau.
        </InfoBox>
      </HelpSection>

      <HelpSection id="diagnostics" title="Diagnostics obligatoires">
        <p>
          {APP_NAME} vous aide à suivre les diagnostics obligatoires de vos immeubles et à anticiper les renouvellements.
        </p>
        <p>
          Les types de diagnostics gérés : DPE (Diagnostic de Performance Énergétique), amiante, plomb, gaz, électricité, termites, ERP (État des Risques et Pollutions), loi Carrez, assainissement et autres.
        </p>
        <p>
          Pour chaque diagnostic, vous renseignez la date de réalisation, la date d&apos;expiration, le résultat et vous pouvez joindre le fichier PDF du rapport. L&apos;application calcule automatiquement le statut :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-emerald-600">Valide</strong> : le diagnostic est en cours de validité</li>
          <li><strong className="text-amber-600">Expire bientôt</strong> : expiration dans les 90 prochains jours</li>
          <li><strong className="text-red-600">Expiré</strong> : le diagnostic doit être renouvelé</li>
        </ul>
        <ScreenshotPlaceholder alt="Liste des diagnostics" caption="Diagnostics avec dates, résultats et indicateurs d'expiration" src="/aide/screenshots/patrimoine-detail.png" />
        <InfoBox type="warning">
          Des diagnostics expirés peuvent entraîner des sanctions légales. L&apos;application vous alerte automatiquement avant l&apos;expiration.
        </InfoBox>
      </HelpSection>

      <HelpSection id="maintenances" title="Maintenances et interventions">
        <p>
          Suivez toutes les interventions techniques sur vos immeubles : plomberie, électricité, toiture, ravalement, etc. Chaque intervention comporte un titre, une description, une date planifiée, un coût estimé et un statut d&apos;avancement.
        </p>
        <HelpStep number={1} title="Planifier une intervention">
          <p>Depuis la fiche immeuble, section <strong>Interventions</strong>, cliquez sur <strong>Nouvelle intervention</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Suivre l'avancement">
          <p>Mettez à jour le statut au fur et à mesure : planifiée, en cours, terminée, annulée. Vous pouvez ajouter le coût réel une fois l&apos;intervention terminée.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Historique des interventions" caption="Liste des interventions avec date, coût et statut" src="/aide/screenshots/patrimoine-detail.png" />
      </HelpSection>

      <HelpSection id="etats-lieux" title="États des lieux">
        <p>
          Les états des lieux d&apos;entrée et de sortie sont accessibles depuis la fiche bail. Ils documentent l&apos;état de chaque pièce et équipement du lot lors de l&apos;entrée et du départ du locataire.
        </p>
        <p>
          Pour chaque état des lieux, vous renseignez la date, la personne ayant réalisé la visite, et les observations pièce par pièce. Vous pouvez joindre des photos et le document PDF signé.
        </p>
        <ScreenshotPlaceholder alt="État des lieux" caption="Formulaire d'état des lieux avec observations par pièce" src="/aide/screenshots/patrimoine-detail.png" />
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur le patrimoine">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment modifier les informations d&apos;un immeuble ?</p>
            <p>Rendez-vous sur la fiche de l&apos;immeuble concerné, puis cliquez sur le bouton <strong>Modifier</strong> en haut de page. Vous pourrez mettre à jour le nom, l&apos;adresse, le type de bien, l&apos;année de construction et la surface totale.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je supprimer un immeuble ?</p>
            <p>Uniquement si aucun lot de cet immeuble n&apos;a de bail actif. Si c&apos;est le cas, la suppression est possible depuis la fiche immeuble. Dans le cas contraire, vous devrez d&apos;abord résilier tous les baux en cours.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment changer le statut d&apos;un lot (vacant, occupé, en travaux) ?</p>
            <p>Le statut d&apos;un lot est mis à jour automatiquement en fonction des baux : il passe à « Occupé » lorsqu&apos;un bail est actif et à « Vacant » lorsque le bail est résilié. Vous pouvez également forcer manuellement le statut depuis la fiche lot (par exemple pour le passer en « En travaux »).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Un lot peut-il avoir plusieurs baux en même temps ?</p>
            <p>Non, un seul bail actif est autorisé par lot. Pour changer de locataire, vous devez d&apos;abord résilier le bail en cours, puis en créer un nouveau.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter un diagnostic DPE ?</p>
            <p>Depuis la fiche immeuble, rendez-vous dans la section <strong>Diagnostics</strong>, puis cliquez sur <strong>Ajouter un diagnostic</strong>. Choisissez le type (DPE), renseignez la date de réalisation, le résultat et joignez le fichier PDF du rapport.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Quand suis-je alerté pour un diagnostic expirant ?</p>
            <p>L&apos;application vous alerte 90 jours avant l&apos;expiration d&apos;un diagnostic avec un badge orange « Expire bientôt ». Une fois le diagnostic expiré, un badge rouge « Expiré » s&apos;affiche pour vous inciter à le renouveler rapidement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment planifier une maintenance ?</p>
            <p>Depuis la fiche immeuble, allez dans la section <strong>Interventions</strong> et cliquez sur <strong>Nouvelle intervention</strong>. Renseignez le titre, la description, la date planifiée et le coût estimé. Vous pourrez ensuite suivre l&apos;avancement et ajouter le coût réel.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment importer plusieurs lots en même temps ?</p>
            <p>Rendez-vous dans <strong>Administration &gt; Import</strong> et uploadez un fichier CSV ou Excel contenant les colonnes suivantes : numéro, type, étage, surface et loyer. L&apos;application vérifiera les données et créera les lots automatiquement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment voir tous les lots vacants ?</p>
            <p>Sur la page <strong>Patrimoine</strong>, le taux d&apos;occupation est affiché pour chaque immeuble. Pour voir le détail, ouvrez la fiche d&apos;un immeuble et filtrez les lots par statut « Vacant » dans le tableau des lots.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Qu&apos;est-ce que l&apos;évaluation IA d&apos;un immeuble ?</p>
            <p>Il s&apos;agit d&apos;une estimation automatique de la valeur de votre immeuble, basée sur l&apos;adresse, la surface, le type de bien, le taux d&apos;occupation et les données de marché (transactions récentes DVF). Accessible depuis la fiche immeuble via le bouton <strong>Évaluation IA</strong>.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter des photos à un état des lieux ?</p>
            <p>Depuis la fiche bail, rendez-vous dans la section <strong>États des lieux</strong>. Lors de la création ou de la modification d&apos;un état des lieux, vous pouvez joindre des photos pour chaque pièce inspectée afin de documenter l&apos;état du logement.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
