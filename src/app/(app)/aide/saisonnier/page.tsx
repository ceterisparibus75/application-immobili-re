import { Umbrella } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Location saisonnière | Centre d'aide | ${APP_NAME}`,
};

export default function SaisonnierPage() {
  return (
    <HelpPageLayout
      slug="saisonnier"
      icon={<Umbrella className="h-6 w-6" />}
      title="Location saisonnière"
      description="Gérez vos biens en location courte durée : gîtes, appartements de vacances, Airbnb. Réservations, tarification et suivi des revenus."
    >
      <HelpSection id="vue-ensemble" title="Vue d'ensemble">
        <p>
          Le module <strong>Saisonnier</strong> est conçu pour les biens loués à la nuitée ou à la semaine : gîtes, meublés de tourisme, appartements Airbnb, chalets, villas, etc.
        </p>
        <p>
          La page principale affiche vos biens saisonniers sous forme de cartes avec pour chacun : le type de bien, le tarif par nuitée, le nombre de réservations actives, le total des nuitées réservées et le revenu cumulé depuis le 1er janvier.
        </p>
        <InfoBox type="info">
          Les réservations annulées ou no-show sont automatiquement exclues des calculs de revenus et de nuitées.
        </InfoBox>
      </HelpSection>

      <HelpSection id="creer-bien" title="Ajouter un bien saisonnier">
        <HelpStep number={1} title="Créez le bien">
          <p>Allez dans <strong>Saisonnier &gt; Nouveau bien</strong>. Choisissez le type parmi : Appartement, Maison, Villa, Studio, Chambre, Gîte ou Chalet.</p>
        </HelpStep>
        <HelpStep number={2} title="Configurez la tarification">
          <p>Renseignez le tarif par nuitée de base. Vous pouvez ensuite créer des grilles tarifaires par saison (haute, basse, moyenne) avec des tarifs différents.</p>
        </HelpStep>
        <HelpStep number={3} title="Gérez les réservations">
          <p>Ajoutez les réservations avec les dates d'arrivée et de départ, le nom du voyageur et le montant total. Le nombre de nuitées et le revenu net sont calculés automatiquement.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous ajoutez votre gîte &laquo; Le Mas Provençal &raquo; (type Gîte, 120 &euro;/nuit). En juillet, vous enregistrez 3 réservations : Famille Martin (7 nuits = 840 &euro;), Couple Durand (4 nuits = 480 &euro;), Groupe Petit (10 nuits = 1 200 &euro;). La page affiche : 3 réservations actives, 21 nuitées, 2 520 &euro; de revenus.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="revenus" title="Suivi des revenus">
        <p>
          Pour chaque bien saisonnier, {APP_NAME} calcule automatiquement :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Revenu total</strong> : somme de toutes les réservations confirmées depuis le 1er janvier</li>
          <li><strong>Revenu net par réservation</strong> : montant moyen perçu par réservation</li>
          <li><strong>Nuitées totales</strong> : nombre total de nuits réservées</li>
          <li><strong>Taux d'occupation</strong> : nuitées réservées / nuitées disponibles sur la période</li>
        </ul>
        <InfoBox type="tip">
          Comparez le revenu par nuitée de vos biens saisonniers pour identifier ceux qui performent le mieux et ajuster vos tarifs en conséquence.
        </InfoBox>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur la location saisonnière">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Quelle différence entre location saisonnière et bail classique ?</p>
            <p>La location saisonnière se gère à la nuitée avec des réservations ponctuelles (module Saisonnier). Le bail classique est un contrat longue durée géré dans le module Baux. Les deux sont indépendants.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment gérer les annulations ?</p>
            <p>Changez le statut de la réservation en &laquo; Annulée &raquo;. Elle sera automatiquement exclue des calculs de revenus et de nuitées.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je définir des tarifs différents selon la saison ?</p>
            <p>Oui, créez plusieurs grilles tarifaires pour un même bien. Exemple : 80 &euro;/nuit en basse saison (novembre-mars), 120 &euro;/nuit en moyenne saison (avril-juin, septembre-octobre), 160 &euro;/nuit en haute saison (juillet-août).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Le module saisonnier est-il inclus dans tous les plans ?</p>
            <p>Oui, la location saisonnière est disponible dès le plan Starter.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
