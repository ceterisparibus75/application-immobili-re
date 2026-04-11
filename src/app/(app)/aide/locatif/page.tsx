import { Users } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Gestion locative | Centre d'aide | ${APP_NAME}`,
};

export default function LocatifPage() {
  return (
    <HelpPageLayout
      slug="locatif"
      icon={<Users className="h-6 w-6" />}
      title="Gestion locative"
      description="Baux, locataires, révisions de loyer, charges, provisions et contacts : tout pour gérer vos locations au quotidien."
    >
      <HelpSection id="baux" title="Gestion des baux">
        <p>
          Le bail est le contrat qui lie un locataire à un lot. La page <strong>Baux</strong> affiche deux sections : les baux actifs (en cours) et les baux terminés (résiliés, expirés).
        </p>
        <p>
          Le tableau récapitulatif présente pour chaque bail : le nom du locataire, le loyer mensuel HT, la fréquence de paiement, le type de bail et son statut. Le total des loyers mensuels est calculé en bas du tableau.
        </p>
        <ScreenshotPlaceholder alt="Liste des baux actifs" caption="Tableau des baux avec locataire, loyer, type et statut" src="/aide/screenshots/baux-main.png" />

        <p className="font-semibold text-foreground mt-6 mb-2">Types de baux disponibles :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Habitation</strong> : bail d&apos;habitation classique (loi du 6 juillet 1989)</li>
          <li><strong>Meublé</strong> : bail de location meublée</li>
          <li><strong>Commercial 3/6/9</strong> : bail commercial avec renouvellement triennal</li>
          <li><strong>Commercial dérogatoire</strong> : bail de courte durée (max. 3 ans)</li>
          <li><strong>Professionnel</strong> : bail pour professions libérales</li>
          <li><strong>Mixte</strong> : bail combinant habitation et activité professionnelle</li>
          <li><strong>Saisonnier</strong> : bail de courte durée pour location saisonnière</li>
        </ul>

        <p className="font-semibold text-foreground mt-6 mb-2">Statuts d&apos;un bail :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-emerald-600">En cours</strong> : bail actif, loyer dû</li>
          <li><strong className="text-red-600">Résilié</strong> : bail terminé par le locataire ou le bailleur</li>
          <li><strong className="text-blue-600">Renouvelé</strong> : bail reconduit</li>
          <li><strong className="text-amber-600">En négociation</strong> : conditions en cours de discussion</li>
          <li><strong className="text-red-700">Contentieux</strong> : litige en cours</li>
        </ul>
      </HelpSection>

      <HelpSection id="fiche-bail" title="Fiche bail détaillée">
        <p>
          En cliquant sur un bail, vous accédez à sa fiche complète, organisée en colonnes :
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Informations générales</p>
            <p>Type de bail, fréquence de paiement, dates de début et fin, durée, période de franchise, pas-de-porte, clause de travaux du locataire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Loyer et finances</p>
            <p>Loyer de base HT, loyer actuel HT (si révisé), TVA applicable, dépôt de garantie. Si le bail est indexé : type d&apos;indice (IRL/ILC/ILAT), valeur de référence, trimestre et fréquence de révision.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Provisions sur charges et taxes</p>
            <p>Charges provisionnelles mensuelles avec détail par catégorie. La régularisation annuelle compare le provisionné au réel.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Révisions de loyer</p>
            <p>Historique de toutes les révisions avec possibilité de valider ou rejeter chaque révision proposée.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Avenants</p>
            <p>Liste des modifications apportées au bail après sa signature (changement de loyer, de clause, etc.).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">États des lieux et inspections</p>
            <p>États des lieux d&apos;entrée et de sortie avec date, intervenant et détail par pièce.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Factures récentes</p>
            <p>Les dernières factures émises pour ce bail, avec numéro, montant, échéance et statut de paiement.</p>
          </div>
        </div>
        <ScreenshotPlaceholder alt="Fiche bail complète" caption="Vue détaillée d'un bail avec toutes les informations contractuelles" src="/aide/screenshots/baux-main.png" />
        <InfoBox type="info">
          Vous pouvez uploader le document PDF du bail signé directement dans la fiche. Il sera stocké de manière sécurisée et accessible à tout moment.
        </InfoBox>
      </HelpSection>

      <HelpSection id="locataires" title="Gestion des locataires">
        <p>
          La page <strong>Locataires</strong> affiche un tableau paginé avec recherche et filtres avancés.
        </p>
        <p>
          Vous pouvez filtrer par : indicateur de risque (vert/orange/rouge), statut d&apos;assurance, type d&apos;entité (personne physique ou morale).
        </p>
        <p>
          Le tableau affiche pour chaque locataire : nom (avec avatar), type d&apos;entité, loyer total cumulé sur tous ses baux, localisation (immeuble + lots), statut d&apos;assurance et indicateur de risque.
        </p>
        <ScreenshotPlaceholder alt="Liste des locataires" caption="Tableau paginé avec recherche, filtres et indicateurs de risque" src="/aide/screenshots/locataires-main.png" />

        <p className="font-semibold text-foreground mt-6 mb-2">Indicateurs de risque :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-emerald-600">Fiable</strong> : paiements à jour, assurance valide</li>
          <li><strong className="text-amber-600">Vigilance</strong> : retards de paiement ponctuels ou assurance expirant</li>
          <li><strong className="text-red-600">Risque</strong> : impayés récurrents, assurance expirée</li>
        </ul>

        <HelpStep number={1} title="Créer un locataire">
          <p>Cliquez sur <strong>Nouveau locataire</strong>. Renseignez l&apos;identité (personne physique : nom, prénom, date de naissance ; personne morale : raison sociale, SIRET), les coordonnées (email, téléphone) et l&apos;adresse.</p>
        </HelpStep>
        <HelpStep number={2} title="Documents du locataire">
          <p>Joignez les pièces justificatives : pièce d&apos;identité, justificatif de domicile, attestation d&apos;assurance, fiches de paie, etc. L&apos;assurance est suivie avec alerte d&apos;expiration automatique.</p>
        </HelpStep>
      </HelpSection>

      <HelpSection id="revisions" title="Révisions de loyer">
        <p>
          Les révisions sont calculées automatiquement à partir des indices INSEE (IRL pour l&apos;habitation, ILC pour le commerce, ILAT pour les bureaux). L&apos;application récupère les indices chaque trimestre et propose les révisions lorsqu&apos;elles sont dues.
        </p>
        <HelpStep number={1} title="Consultez les révisions en attente">
          <p>Allez dans <strong>Révisions</strong>. Vous verrez la liste de toutes les révisions dues avec le loyer actuel, le nouveau loyer calculé et le pourcentage d&apos;augmentation.</p>
        </HelpStep>
        <HelpStep number={2} title="Validez ou rejetez">
          <p>Pour chaque révision, vous pouvez <strong>Valider</strong> (le loyer est mis à jour automatiquement) ou <strong>Rejeter</strong> (le loyer reste inchangé). Un historique complet est conservé.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Page des révisions de loyer" caption="Liste des révisions en attente avec ancien loyer, nouveau loyer et variation" src="/aide/screenshots/baux-main.png" />
        <InfoBox type="tip">
          Les indices sont mis à jour automatiquement le 1er de chaque mois via un processus planifié. Vous pouvez consulter les derniers indices dans le module Indices.
        </InfoBox>
      </HelpSection>

      <HelpSection id="charges" title="Charges et provisions">
        <p>
          Le module <strong>Charges</strong> vous permet de suivre toutes les dépenses liées à vos immeubles : charges de copropriété, taxes foncières, assurances, entretien, etc.
        </p>
        <p>
          Chaque charge est classée par catégorie et par nature : <strong>exploitant</strong> (à la charge du propriétaire) ou <strong>récupérable</strong> (refacturable au locataire).
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Bibliothèque de charges</p>
            <p>Créez des modèles de charges récurrentes pour gagner du temps. Définissez la catégorie, la nature, le fournisseur par défaut et le montant habituel.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comptes rendus</p>
            <p>Générez des rapports récapitulatifs par immeuble ou par catégorie, utiles pour la régularisation annuelle des charges.</p>
          </div>
        </div>
        <ScreenshotPlaceholder alt="Liste des charges" caption="Tableau des charges avec catégorie, montant, immeuble et statut de paiement" src="/aide/screenshots/charges-main.png" />
      </HelpSection>

      <HelpSection id="contacts" title="Carnet de contacts">
        <p>
          Le module <strong>Contacts</strong> centralise tous vos interlocuteurs : prestataires, notaires, experts, syndics, agences et autres.
        </p>
        <p>
          Les contacts sont affichés sous forme de cartes classées par type, avec un code couleur par catégorie. Vous pouvez rechercher et filtrer par type ou par spécialité.
        </p>
        <p>
          Le bouton <strong>Synchroniser les locataires</strong> importe automatiquement tous les locataires actifs dans le carnet de contacts, pour les retrouver facilement.
        </p>
        <ScreenshotPlaceholder alt="Carnet de contacts" caption="Contacts affichés en cartes avec type, coordonnées et spécialité" src="/aide/screenshots/contacts-main.png" />
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur la gestion locative">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment résilier un bail ?</p>
            <p>Rendez-vous sur la fiche du bail concerné et cliquez sur le bouton <strong>Résilier</strong>. Renseignez la date de résiliation et le motif. Le lot associé redeviendra automatiquement vacant.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je renouveler un bail expiré ?</p>
            <p>Non, un bail résilié ou expiré ne peut pas être réactivé. Vous devez créer un nouveau bail pour le même lot et le même locataire si nécessaire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment modifier le loyer d&apos;un bail ?</p>
            <p>Le loyer peut être modifié de deux façons : via une révision de loyer automatique basée sur les indices INSEE (IRL, ILC, ILAT), ou via un avenant au bail pour toute modification contractuelle.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment fonctionne la révision automatique de loyer ?</p>
            <p>La révision est basée sur les indices INSEE. La formule appliquée est : nouveau loyer = ancien loyer × (nouvel indice / ancien indice). L&apos;application propose automatiquement la révision à la date anniversaire du bail. Vous pouvez la valider ou la rejeter.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment faire un rattrapage de révisions en retard ?</p>
            <p>Rendez-vous sur la page <strong>Indices</strong> et cliquez sur le bouton <strong>Rattraper</strong>. L&apos;application calculera année par année les révisions manquées et vous proposera de les appliquer.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter un avenant au bail ?</p>
            <p>Depuis la fiche bail, rendez-vous dans la section <strong>Avenants</strong> et cliquez sur <strong>Nouvel avenant</strong>. Renseignez l&apos;objet de la modification, la date d&apos;effet et les nouvelles conditions applicables.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment gérer le dépôt de garantie ?</p>
            <p>Le montant du dépôt de garantie est renseigné lors de la création du bail. Il est affiché sur la fiche bail et pris en compte dans les rapports financiers. Sa restitution est gérée lors de la résiliation du bail.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment archiver un locataire qui est parti ?</p>
            <p>Le locataire est automatiquement archivé lorsque son dernier bail est résilié. Conformément au RGPD, ses données personnelles sont conservées pendant 5 ans après la fin de la relation contractuelle, puis supprimées.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment gérer les charges récupérables ?</p>
            <p>Dans le module <strong>Charges</strong>, créez des charges avec la nature « Récupérable ». Ces charges seront automatiquement prises en compte lors de la régularisation annuelle et refacturées au locataire concerné.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment créer une provision sur charges ?</p>
            <p>Depuis la fiche bail, rendez-vous dans la section <strong>Charges</strong> et cliquez sur <strong>Ajouter une provision</strong>. Définissez la catégorie de charge et le montant mensuel provisionné.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment faire la régularisation annuelle des charges ?</p>
            <p>Comparez le total des provisions versées par le locataire au total réel des charges récupérables de l&apos;année. Créez ensuite une facture de régularisation : positive si le locataire doit un complément, négative si un trop-perçu doit lui être remboursé.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment synchroniser les locataires dans le carnet de contacts ?</p>
            <p>Rendez-vous sur la page <strong>Contacts</strong> et cliquez sur le bouton <strong>Synchroniser les locataires</strong>. Tous les locataires actifs seront automatiquement importés dans votre carnet de contacts.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment ajouter un garant ou une caution pour un locataire ?</p>
            <p>Lors de la création du bail, vous pouvez renseigner les informations du garant : nom, prénom, adresse et profession. Ces informations sont conservées dans la fiche bail et accessibles à tout moment.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
