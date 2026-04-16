import { FileText } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

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
      </HelpSection>

      <HelpSection id="generation-auto" title="Génération automatique des factures">
        <p>
          Chaque mois, {APP_NAME} génère automatiquement des brouillons de factures pour tous les baux actifs. Ce processus planifié s'exécute quotidiennement à 7h du matin.
        </p>
        <HelpStep number={1} title="Vérifiez les brouillons">
          <p>Les factures générées ont le statut <strong>Brouillon</strong>. Consultez-les dans l'onglet Brouillons pour vérifier les montants (loyer + charges + taxes).</p>
        </HelpStep>
        <HelpStep number={2} title="Validez les factures">
          <p>Cliquez sur <strong>Valider</strong> pour chaque facture. La facture passe au statut <strong>Validée</strong> et un numéro de facture séquentiel lui est attribué.</p>
        </HelpStep>
        <HelpStep number={3} title="Envoyez par email">
          <p>Envoyez la facture au locataire en un clic. Un PDF est généré automatiquement avec votre logo, les coordonnées bancaires et le détail des lignes.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Le 1er avril à 7h, {APP_NAME} crée un brouillon &laquo; FAC-2026-0042 &raquo; pour le bail de Jean Dupont : loyer 950 &euro; + charges 80 &euro; = 1 030 &euro; TTC. Vous le vérifiez dans Brouillons, cliquez sur Valider, puis sur Envoyer par email. Jean reçoit un PDF professionnel avec votre logo, l'IBAN pour le virement et le QR code de paiement.
          </p>
        </div>
        <InfoBox type="tip">
          Vous pouvez aussi générer des appels de loyer manuellement depuis le bouton <strong>Générer des appels</strong>. Cela crée des brouillons pour les baux sélectionnés. Utile si vous devez facturer une période spécifique.
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
          Lorsqu'un locataire paie son loyer, vous enregistrez le paiement dans {APP_NAME}. L'application gère les paiements totaux, partiels et multi-factures.
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
      </HelpSection>

      <HelpSection id="relances" title="Relances automatiques">
        <p>
          Les factures impayées sont relancées automatiquement selon un système en 3 niveaux. Les relances sont envoyées chaque lundi matin à 8h.
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 1 : Relance courtoise</p>
            <p>Envoyée 7 jours après la date d'échéance. Ton amical rappelant le montant dû et la date d'échéance dépassée.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 2 : Relance ferme</p>
            <p>Envoyée 21 jours après l'échéance. Ton plus formel mentionnant les conséquences possibles en cas de non-paiement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Niveau 3 : Mise en demeure</p>
            <p>Envoyée 45 jours après l'échéance. Dernier rappel avant procédure contentieuse, mentionnant les recours légaux.</p>
          </div>
        </div>
        <InfoBox type="info">
          Vous pouvez aussi envoyer des relances manuellement à tout moment depuis la page Relances. Sélectionnez les factures concernées et cliquez sur Envoyer la relance.
        </InfoBox>
      </HelpSection>

      <HelpSection id="quittances" title="Quittances de loyer">
        <p>
          Une quittance est un reçu officiel attestant que le locataire a bien payé son loyer. Elle est générée uniquement pour les factures dont le paiement est complet.
        </p>
        <HelpStep number={1} title="Générer une quittance">
          <p>Depuis la fiche d'une facture payée, cliquez sur <strong>Générer la quittance</strong>. Un PDF est créé avec les informations du bailleur, du locataire, la période concernée et le détail du paiement.</p>
        </HelpStep>
        <HelpStep number={2} title="Envoyer par email">
          <p>La quittance peut être envoyée directement par email au locataire ou téléchargée en PDF.</p>
        </HelpStep>
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
      </HelpSection>

      <HelpSection id="avoirs" title="Avoirs (notes de crédit)">
        <p>
          Si vous devez annuler ou corriger une facture déjà validée, vous pouvez émettre un <strong>avoir</strong> (note de crédit). L'avoir est lié à la facture d'origine et vient en déduction du montant dû.
        </p>
        <p>
          Depuis la fiche d'une facture, cliquez sur <strong>Créer un avoir</strong>. Renseignez le motif et le montant (total ou partiel). La facture originale est automatiquement mise à jour.
        </p>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur la facturation">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment créer une facture manuellement ?</p>
            <p>Allez dans <strong>Facturation &gt; Nouvelle facture</strong>. Sélectionnez le bail, la période et les lignes de facturation (loyer, charges, taxes, honoraires). La facture est créée en brouillon.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment annuler une facture déjà validée ?</p>
            <p>Depuis la fiche facture, cliquez sur <strong>Créer un avoir</strong>. L'avoir annule le montant et la facture originale est automatiquement marquée comme annulée. Vous ne pouvez pas supprimer une facture validée directement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment gérer un paiement partiel ?</p>
            <p>Enregistrez le paiement avec le montant effectivement reçu. La facture passe au statut <strong>Partiellement payée</strong> et le solde restant dû est affiché clairement sur la fiche facture.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment envoyer une facture par email au locataire ?</p>
            <p>Depuis la fiche facture, cliquez sur le bouton <strong>Envoyer par email</strong>. Un PDF est généré automatiquement avec votre logo et vos coordonnées bancaires, puis envoyé à l'adresse email du locataire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Les factures sont-elles générées automatiquement ?</p>
            <p>Oui, chaque jour à 7h du matin, {APP_NAME} génère des brouillons de factures pour tous les baux actifs. Ces brouillons doivent ensuite être vérifiés et validés manuellement avant envoi.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment valider plusieurs factures en une fois ?</p>
            <p>Dans l'onglet <strong>Brouillons</strong>, sélectionnez les factures souhaitées à l'aide des cases à cocher, puis utilisez l'action groupée <strong>Valider</strong> pour les valider toutes en un clic.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment voir les factures impayées ?</p>
            <p>Cliquez sur l'onglet <strong>En retard</strong> sur la page Facturation. Le KPI <strong>Impayés</strong> en haut de page affiche le montant total des factures impayées ainsi que leur nombre.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment personnaliser le contenu d'une facture ?</p>
            <p>Chaque facture peut comporter des lignes personnalisées : loyer, charges, taxes, honoraires ou tout autre intitulé. Modifiez les lignes directement depuis la fiche facture, tant qu'elle est au statut brouillon.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Qu'est-ce qu'une quittance de loyer ?</p>
            <p>C'est un reçu officiel attestant que le locataire a payé son loyer pour une période donnée. Elle est générée uniquement pour les factures dont le paiement est complet (pas pour les paiements partiels).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment générer une quittance ?</p>
            <p>Depuis la fiche d'une facture entièrement payée, cliquez sur <strong>Générer la quittance</strong>. Le PDF est créé automatiquement et peut être téléchargé ou envoyé par email au locataire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment fonctionnent les relances automatiques ?</p>
            <p>Les relances suivent 3 niveaux : <strong>courtoise</strong> (7 jours après l'échéance), <strong>ferme</strong> (21 jours) et <strong>mise en demeure</strong> (45 jours). Elles sont envoyées automatiquement chaque lundi à 8h du matin.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment désactiver les relances automatiques pour un locataire ?</p>
            <p>Les relances automatiques s'appliquent à toutes les factures impayées. Si vous souhaitez gérer un locataire au cas par cas, vous pouvez envoyer les relances manuellement depuis la page <strong>Relances</strong>.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Qu'est-ce que le prélèvement SEPA ?</p>
            <p>C'est un système de prélèvement automatique européen. Créez un mandat SEPA avec l'IBAN du locataire, puis générez un fichier XML regroupant tous les prélèvements à effectuer. Ce fichier est à transmettre directement à votre banque.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment régulariser les charges en fin d'année ?</p>
            <p>Comparez les provisions versées par le locataire avec les charges réellement engagées, puis créez une facture de régularisation. Si le locataire a trop payé, émettez un avoir pour le montant excédentaire.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
