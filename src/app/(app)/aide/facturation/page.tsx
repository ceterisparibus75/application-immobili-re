import { FileText } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Facturation et paiements | Centre d'aide | ${APP_NAME}`,
};

export default function FacturationPage() {
  return (
    <HelpPageLayout
      slug="facturation"
      icon={<FileText className="h-6 w-6" />}
      title="Facturation et paiements"
      description="Factures automatiques, enregistrement des paiements, relances, prélèvement SEPA et quittances de loyer."
    >
      <HelpSection id="vue-ensemble" title="Vue d'ensemble de la facturation">
        <p>
          La page <strong>Facturation</strong> présente 4 indicateurs clés en haut de page : le montant total TTC facturé, le montant des impayés (avec le nombre de factures concernées), le nombre de factures en retard et le nombre de relances envoyées.
        </p>
        <p>
          Les factures sont organisées en onglets : <strong>Toutes</strong>, <strong>Brouillons</strong>, <strong>En retard</strong> et <strong>Relances</strong>. Chaque onglet affiche un tableau filtrable et triable.
        </p>
        <ScreenshotPlaceholder alt="Page principale de facturation" caption="Vue d'ensemble avec KPI et onglets de filtrage des factures" />
      </HelpSection>

      <HelpSection id="generation-auto" title="Génération automatique des factures">
        <p>
          Chaque mois, {APP_NAME} génère automatiquement des brouillons de factures pour tous les baux actifs. Ce processus planifié s&apos;exécute quotidiennement à 7h du matin.
        </p>
        <HelpStep number={1} title="Vérifiez les brouillons">
          <p>Les factures générées ont le statut <strong>Brouillon</strong>. Consultez-les dans l&apos;onglet Brouillons pour vérifier les montants (loyer + charges + taxes).</p>
        </HelpStep>
        <HelpStep number={2} title="Validez les factures">
          <p>Cliquez sur <strong>Valider</strong> pour chaque facture. La facture passe au statut <strong>Validée</strong> et un numéro de facture séquentiel lui est attribué.</p>
        </HelpStep>
        <HelpStep number={3} title="Envoyez par email">
          <p>Envoyez la facture au locataire en un clic. Un PDF est généré automatiquement avec votre logo, les coordonnées bancaires et le détail des lignes.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Brouillons de factures" caption="Liste des brouillons à valider avec montant, locataire et échéance" />
        <InfoBox type="tip">
          Vous pouvez aussi générer des appels de loyer manuellement depuis le bouton <strong>Générer des appels</strong>. Cela crée des brouillons pour les baux sélectionnés.
        </InfoBox>
      </HelpSection>

      <HelpSection id="statuts" title="Cycle de vie d'une facture">
        <p>
          Une facture suit un parcours précis, chaque étape étant identifiable par un badge de couleur :
        </p>
        <div className="space-y-2">
          {[
            { status: "Brouillon", color: "bg-gray-100 text-gray-700", desc: "Facture générée automatiquement, en attente de validation" },
            { status: "Validée", color: "bg-blue-100 text-blue-700", desc: "Facture vérifiée, prête à être envoyée" },
            { status: "Envoyée", color: "bg-indigo-100 text-indigo-700", desc: "Facture transmise au locataire par email" },
            { status: "En attente", color: "bg-amber-100 text-amber-700", desc: "En attente de paiement avant la date d'échéance" },
            { status: "Payée", color: "bg-emerald-100 text-emerald-700", desc: "Paiement reçu en totalité" },
            { status: "Partiellement payée", color: "bg-orange-100 text-orange-700", desc: "Paiement partiel reçu, solde restant dû" },
            { status: "En retard", color: "bg-red-100 text-red-700", desc: "Date d'échéance dépassée, paiement non reçu" },
            { status: "Relancée", color: "bg-purple-100 text-purple-700", desc: "Une ou plusieurs relances envoyées" },
            { status: "Annulée", color: "bg-gray-100 text-gray-500", desc: "Facture annulée (avoir émis)" },
          ].map((s) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${s.color}`}>{s.status}</span>
              <span className="text-sm">{s.desc}</span>
            </div>
          ))}
        </div>
      </HelpSection>

      <HelpSection id="paiements" title="Enregistrement des paiements">
        <p>
          Lorsqu&apos;un locataire paie son loyer, vous enregistrez le paiement dans {APP_NAME}. L&apos;application gère les paiements totaux, partiels et multi-factures.
        </p>
        <HelpStep number={1} title="Paiement total">
          <p>Depuis la fiche facture, cliquez sur <strong>Enregistrer un paiement</strong>. Sélectionnez le mode de paiement (virement, chèque, espèces, prélèvement) et la date. Le montant est pré-rempli avec le solde dû.</p>
        </HelpStep>
        <HelpStep number={2} title="Paiement partiel">
          <p>Modifiez le montant pour enregistrer un paiement partiel. La facture passe au statut <strong>Partiellement payée</strong> et le solde restant est affiché.</p>
        </HelpStep>
        <HelpStep number={3} title="Paiement multi-factures">
          <p>Si le locataire paie plusieurs factures en un seul virement, vous pouvez ventiler le montant sur plusieurs factures depuis la page de paiement.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Enregistrement d'un paiement" caption="Formulaire de paiement avec mode, date et montant" />
      </HelpSection>

      <HelpSection id="relances" title="Relances automatiques">
        <p>
          Les factures impayées sont relancées automatiquement selon un système en 3 niveaux. Les relances sont envoyées chaque lundi matin à 8h.
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 1 : Relance courtoise</p>
            <p>Envoyée 7 jours après la date d&apos;échéance. Ton amical rappelant le montant dû et la date d&apos;échéance dépassée.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 2 : Relance ferme</p>
            <p>Envoyée 21 jours après l&apos;échéance. Ton plus formel mentionnant les conséquences possibles en cas de non-paiement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 3 : Mise en demeure</p>
            <p>Envoyée 45 jours après l&apos;échéance. Dernier rappel avant procédure contentieuse, mentionnant les recours légaux.</p>
          </div>
        </div>
        <ScreenshotPlaceholder alt="Page des relances" caption="Factures impayées avec historique des relances envoyées par locataire" />
        <InfoBox type="info">
          Vous pouvez aussi envoyer des relances manuellement à tout moment depuis la page Relances. Sélectionnez les factures concernées et cliquez sur Envoyer la relance.
        </InfoBox>
      </HelpSection>

      <HelpSection id="quittances" title="Quittances de loyer">
        <p>
          Une quittance est un reçu officiel attestant que le locataire a bien payé son loyer. Elle est générée uniquement pour les factures dont le paiement est complet.
        </p>
        <HelpStep number={1} title="Générer une quittance">
          <p>Depuis la fiche d&apos;une facture payée, cliquez sur <strong>Générer la quittance</strong>. Un PDF est créé avec les informations du bailleur, du locataire, la période concernée et le détail du paiement.</p>
        </HelpStep>
        <HelpStep number={2} title="Envoyer par email">
          <p>La quittance peut être envoyée directement par email au locataire ou téléchargée en PDF.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Quittance de loyer PDF" caption="Aperçu du PDF de quittance avec logo, montants et signature" />
      </HelpSection>

      <HelpSection id="sepa" title="Prélèvement SEPA">
        <p>
          Le module SEPA vous permet de générer des mandats de prélèvement et des fichiers de prélèvement à transmettre à votre banque.
        </p>
        <HelpStep number={1} title="Créez un mandat SEPA">
          <p>Pour chaque locataire qui paie par prélèvement, créez un mandat SEPA avec ses coordonnées bancaires (IBAN/BIC). Le locataire doit signer ce mandat.</p>
        </HelpStep>
        <HelpStep number={2} title="Générez le fichier de prélèvement">
          <p>En fin de mois, générez un fichier SEPA regroupant tous les prélèvements à effectuer. Ce fichier au format XML peut être transmis directement à votre banque.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Gestion SEPA" caption="Liste des mandats SEPA avec génération du fichier de prélèvement" />
      </HelpSection>

      <HelpSection id="avoirs" title="Avoirs (notes de crédit)">
        <p>
          Si vous devez annuler ou corriger une facture déjà validée, vous pouvez émettre un <strong>avoir</strong> (note de crédit). L&apos;avoir est lié à la facture d&apos;origine et vient en déduction du montant dû.
        </p>
        <p>
          Depuis la fiche d&apos;une facture, cliquez sur <strong>Créer un avoir</strong>. Renseignez le motif et le montant (total ou partiel). La facture originale est automatiquement mise à jour.
        </p>
        <ScreenshotPlaceholder alt="Création d'un avoir" caption="Formulaire d'avoir avec motif et montant" />
      </HelpSection>
    </HelpPageLayout>
  );
}
