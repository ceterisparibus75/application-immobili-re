import { Building2 } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

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
          La page <strong>Patrimoine</strong> affiche la liste de tous vos immeubles avec des indicateurs clés : nombre de lots, taux d'occupation, revenus annuels et valeur estimée du patrimoine.
        </p>
        <p>
          Chaque immeuble est présenté sous forme de carte avec un badge de type (habitation, bureau, commerce, mixte), le nombre de lots occupés sur le total, le revenu locatif annuel et le rendement brut (en vert si &ge; 5%, orange si 3-5%, rouge si &lt; 3%).
        </p>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous avez 3 immeubles. La carte de la &laquo; Résidence les Acacias &raquo; affiche : 8 lots (6 occupés / 2 vacants), 75% d'occupation, 58 200 &euro;/an de revenus, rendement brut 5.8% (badge vert). Un badge orange alerte : &laquo; 1 bail expire dans 60 jours &raquo;.
          </p>
        </div>
        <InfoBox type="tip">
          Un indicateur d'alerte s'affiche si un bail expire dans les 90 prochains jours sur l'un de vos immeubles. Les rendements sont colorés : vert &ge; 5%, orange 3-5%, rouge &lt; 3%.
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
            <p>Liste de tous les diagnostics obligatoires (DPE, amiante, plomb, gaz, électricité, etc.) avec la date de réalisation, le résultat et la date d'expiration. Un code couleur indique les diagnostics expirés (rouge) ou expirant bientôt (orange).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Interventions techniques</p>
            <p>Historique des maintenances et interventions avec titre, date planifiée, coût et statut d'avancement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Documents</p>
            <p>Tous les documents rattachés à l'immeuble, classés par catégorie avec alerte d'expiration pour les documents à durée limitée.</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="lots" title="Gestion des lots">
        <p>
          Un lot représente une unité locative au sein d'un immeuble : appartement, local commercial, parking, cave, etc.
        </p>
        <HelpStep number={1} title="Créer un lot">
          <p>Depuis la fiche immeuble, cliquez sur <strong>Ajouter un lot</strong>. Renseignez le numéro/identifiant, le type de lot, l'étage, la surface en m² et le loyer de référence.</p>
        </HelpStep>
        <HelpStep number={2} title="Types de lots disponibles">
          <p>Habitation, meublé, commercial, bureau, parking, cave, entrepôt, terrain, mixte et autre. Le type influence les options de bail disponibles.</p>
        </HelpStep>
        <HelpStep number={3} title="Statuts d'un lot">
          <p>Un lot peut être <strong>Vacant</strong> (disponible à la location), <strong>Occupé</strong> (bail actif), <strong>En travaux</strong> (indisponible temporairement) ou <strong>Réservé</strong> (bail en préparation).</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous créez le lot &laquo; Apt 3B &raquo; (type Habitation, 2e étage, 65 m², loyer de référence 850 &euro;/mois). Son statut initial est &laquo; Vacant &raquo;. Quand vous créez un bail pour ce lot, il passe automatiquement à &laquo; Occupé &raquo;. Si le locataire part et que vous prévoyez des travaux de rafraîchissement, passez-le manuellement en &laquo; En travaux &raquo;.
          </p>
        </div>
        <InfoBox type="info">
          Un lot ne peut avoir qu'un seul bail actif à la fois. Pour changer de locataire, il faut d'abord résilier le bail en cours, puis en créer un nouveau. L'historique de tous les baux passés reste consultable.
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
          Pour chaque diagnostic, vous renseignez la date de réalisation, la date d'expiration, le résultat et vous pouvez joindre le fichier PDF du rapport. L'application calcule automatiquement le statut :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-emerald-600">Valide</strong> : le diagnostic est en cours de validité</li>
          <li><strong className="text-amber-600">Expire bientôt</strong> : expiration dans les 90 prochains jours</li>
          <li><strong className="text-red-600">Expiré</strong> : le diagnostic doit être renouvelé</li>
        </ul>
        <InfoBox type="warning">
          Des diagnostics expirés peuvent entraîner des sanctions légales. L'application vous alerte automatiquement avant l'expiration.
        </InfoBox>
      </HelpSection>

      <HelpSection id="maintenances" title="Maintenances et interventions">
        <p>
          Suivez toutes les interventions techniques sur vos immeubles : plomberie, électricité, toiture, ravalement, etc. Chaque intervention comporte un titre, une description, une date planifiée, un coût estimé et un statut d'avancement.
        </p>
        <HelpStep number={1} title="Planifier une intervention">
          <p>Depuis la fiche immeuble, section <strong>Interventions</strong>, cliquez sur <strong>Nouvelle intervention</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Suivre l'avancement">
          <p>Mettez à jour le statut au fur et à mesure : planifiée, en cours, terminée, annulée. Vous pouvez ajouter le coût réel une fois l'intervention terminée.</p>
        </HelpStep>
      </HelpSection>

      <HelpSection id="etats-lieux" title="États des lieux">
        <p>
          Les états des lieux d'entrée et de sortie sont accessibles depuis la fiche bail. Ils documentent l'état de chaque pièce et équipement du lot lors de l'entrée et du départ du locataire.
        </p>
        <p>
          Pour chaque état des lieux, vous renseignez la date, la personne ayant réalisé la visite, et les observations pièce par pièce. Vous pouvez joindre des photos et le document PDF signé.
        </p>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur le patrimoine">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment modifier les informations d'un immeuble ?</p>
            <p>Rendez-vous sur la fiche de l'immeuble concerné, puis cliquez sur le bouton <strong>Modifier</strong> en haut de page. Vous pourrez mettre à jour le nom, l'adresse, le type de bien, l'année de construction et la surface totale.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je supprimer un immeuble ?</p>
            <p>Uniquement si aucun lot de cet immeuble n'a de bail actif. Si c'est le cas, la suppression est possible depuis la fiche immeuble. Dans le cas contraire, vous devrez d'abord résilier tous les baux en cours.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment changer le statut d'un lot (vacant, occupé, en travaux) ?</p>
            <p>Le statut d'un lot est mis à jour automatiquement en fonction des baux : il passe à « Occupé » lorsqu'un bail est actif et à « Vacant » lorsque le bail est résilié. Vous pouvez également forcer manuellement le statut depuis la fiche lot (par exemple pour le passer en « En travaux »).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Un lot peut-il avoir plusieurs baux en même temps ?</p>
            <p>Non, un seul bail actif est autorisé par lot. Pour changer de locataire, vous devez d'abord résilier le bail en cours, puis en créer un nouveau.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter un diagnostic DPE ?</p>
            <p>Depuis la fiche immeuble, rendez-vous dans la section <strong>Diagnostics</strong>, puis cliquez sur <strong>Ajouter un diagnostic</strong>. Choisissez le type (DPE), renseignez la date de réalisation, le résultat et joignez le fichier PDF du rapport.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Quand suis-je alerté pour un diagnostic expirant ?</p>
            <p>L'application vous alerte 90 jours avant l'expiration d'un diagnostic avec un badge orange « Expire bientôt ». Une fois le diagnostic expiré, un badge rouge « Expiré » s'affiche pour vous inciter à le renouveler rapidement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment planifier une maintenance ?</p>
            <p>Depuis la fiche immeuble, allez dans la section <strong>Interventions</strong> et cliquez sur <strong>Nouvelle intervention</strong>. Renseignez le titre, la description, la date planifiée et le coût estimé. Vous pourrez ensuite suivre l'avancement et ajouter le coût réel.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment importer plusieurs lots en même temps ?</p>
            <p>Rendez-vous dans <strong>Administration &gt; Import</strong> et uploadez un fichier CSV ou Excel contenant les colonnes suivantes : numéro, type, étage, surface et loyer. L'application vérifiera les données et créera les lots automatiquement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment voir tous les lots vacants ?</p>
            <p>Sur la page <strong>Patrimoine</strong>, le taux d'occupation est affiché pour chaque immeuble. Pour voir le détail, ouvrez la fiche d'un immeuble et filtrez les lots par statut « Vacant » dans le tableau des lots.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Qu'est-ce que l'évaluation IA d'un immeuble ?</p>
            <p>Il s'agit d'une estimation automatique de la valeur de votre immeuble, basée sur l'adresse, la surface, le type de bien, le taux d'occupation et les données de marché (transactions récentes DVF). Accessible depuis la fiche immeuble via le bouton <strong>Évaluation IA</strong>.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter des photos à un état des lieux ?</p>
            <p>Depuis la fiche bail, rendez-vous dans la section <strong>États des lieux</strong>. Lors de la création ou de la modification d'un état des lieux, vous pouvez joindre des photos pour chaque pièce inspectée afin de documenter l'état du logement.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
