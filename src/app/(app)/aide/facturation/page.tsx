import { FileText } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

import { APP_NAME } from "@/lib/constants";

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
          La page <strong>Facturation</strong> sert au pilotage de masse des factures : contrôler les brouillons, envoyer les factures prêtes, consulter le registre, suivre les retards et retrouver les quittances.
        </p>
        <p>
          Les factures sont organisées en onglets : <strong>À traiter</strong>, <strong>Brouillons</strong>, <strong>Factures</strong>, <strong>Relances</strong> et <strong>Quittances</strong>. Cette séparation évite de mélanger les actions de masse et la simple consultation.
        </p>
        <p>
          Pour le suivi d'un locataire précis, ouvrez sa fiche : l'onglet <strong>Facturation</strong> permet de retrouver, filtrer, valider et dupliquer ses pièces de facturation, puis l'onglet <strong>Compte locataire</strong> détaille le solde, les paiements, les avoirs et les mouvements historiques.
        </p>
      </HelpSection>

      <HelpSection id="onglets-facturation" title="Comprendre les onglets du module Facturation">
        <HelpStep number={1} title="À traiter">
          <p>
            C'est la file de travail opérationnelle. Elle regroupe les brouillons à contrôler, les factures validées mais non envoyées, les retards à suivre et l'accès à la génération de masse. La carte <strong>À envoyer</strong> descend vers la liste d'envoi quand des factures sont disponibles ; si le compteur est à zéro, elle est affichée comme inactive.
          </p>
        </HelpStep>
        <HelpStep number={2} title="Brouillons">
          <p>
            Cet onglet contient les factures préparées mais pas encore validées. Une facture en brouillon peut être contrôlée, ajustée, validée ou supprimée selon le cas.
          </p>
        </HelpStep>
        <HelpStep number={3} title="Factures">
          <p>
            Cet onglet est un registre de consultation. Il affiche les factures et avoirs validés, avec recherche et filtres, mais sans sélection de masse pour l'envoi.
          </p>
        </HelpStep>
        <HelpStep number={4} title="Relances">
          <p>
            Cet onglet synthétise les factures en retard et donne accès au module <strong>Relances</strong>, où l'envoi et l'historique des relances sont centralisés.
          </p>
        </HelpStep>
        <HelpStep number={5} title="Quittances">
          <p>
            Les quittances disposent de leur propre registre après <strong>Relances</strong>. Elles ne sont pas mélangées au registre des factures afin de conserver une lecture plus claire des reçus de paiement.
          </p>
        </HelpStep>
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
          <p>Depuis <strong>À traiter</strong>, utilisez la section <strong>Factures à envoyer</strong> pour transmettre les factures validées en masse. Un PDF est généré automatiquement avec votre logo, les coordonnées bancaires et le détail des lignes.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Le 1er avril à 7h, {APP_NAME} crée un brouillon &laquo; FAC-2026-0042 &raquo; pour le bail de Jean Dupont : loyer 950 &euro; + charges 80 &euro; = 1 030 &euro; TTC. Vous le vérifiez dans Brouillons, cliquez sur Valider, puis l'envoyez depuis <strong>À traiter</strong>. Jean reçoit un PDF professionnel avec votre logo, l'IBAN pour le virement et le QR code de paiement.
          </p>
        </div>
        <InfoBox type="tip">
          Vous pouvez aussi générer des appels de loyer manuellement depuis le bouton <strong>Générer les appels</strong>. Cela crée des brouillons pour les baux sélectionnés. Pour un cas isolé, utilisez <strong>Facture ponctuelle</strong>.
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

      <HelpSection id="compte-locataire" title="Onglets Facturation et Compte locataire">
        <p>
          La fiche locataire sépare les informations financières en deux onglets pour éviter de mélanger les factures MyGestia et les mouvements de compte.
        </p>
        <HelpStep number={1} title="Piloter les pièces du locataire">
          <p>Depuis <strong>Locataires</strong>, ouvrez la fiche du locataire. L'onglet <strong>Facturation</strong> affiche les brouillons, factures en attente, factures émises, avoirs et factures en retard avec leur date, numéro ou brouillon, type, période, montant TTC et statut.</p>
        </HelpStep>
        <HelpStep number={2} title="Valider ou dupliquer">
          <p>Les brouillons peuvent être validés directement depuis la ligne. L'action <strong>Dupliquer</strong> crée une nouvelle facture en brouillon dans le module Facturation, sans reprendre les paiements ni le numéro.</p>
        </HelpStep>
        <HelpStep number={3} title="Suivre la situation du compte">
          <p>L'onglet <strong>Compte locataire</strong> présente les indicateurs : total facturé, total avoirs, total paiements et solde dû. Le tableau des mouvements déroule les débits et crédits dans l'ordre chronologique.</p>
        </HelpStep>
        <HelpStep number={4} title="Importer un historique">
          <p>Utilisez <strong>Importer un relevé</strong> pour reprendre un export CSV/TSV d'un ancien logiciel : date, libellé, débit, crédit, solde après mouvement, référence et période concernée. Ces lignes restent des mouvements historiques, sans numéro de facture MyGestia.</p>
        </HelpStep>
        <HelpStep number={5} title="Importer un solde précédent">
          <p>Utilisez <strong>Importer un solde précédent</strong> pour reprendre un montant TTC dû ou créditeur à la date de démarrage. Cette reprise ne génère aucune facture.</p>
        </HelpStep>
        <InfoBox type="info">
          Les factures restent des pièces comptables numérotées. Les reprises de solde et imports de relevés sont de simples mouvements de compte locataire.
        </InfoBox>
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
          Depuis l'onglet <strong>Relances</strong> du module Facturation, vous visualisez les factures concernées et ouvrez le module dédié. Vous pouvez aussi envoyer des relances manuellement à tout moment depuis la page <strong>Relances</strong>.
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
        <HelpStep number={3} title="Retrouver les quittances">
          <p>Les quittances validées sont regroupées dans l'onglet <strong>Quittances</strong> du module Facturation, placé après <strong>Relances</strong>.</p>
        </HelpStep>
      </HelpSection>

      <HelpSection id="preuves-envoi" title="Preuves d'envoi des factures et quittances">
        <p>
          Chaque envoi de facture ou de quittance par email crée une preuve d'envoi consultable depuis la fiche facture et depuis <strong>Documents &gt; Preuves d'envoi</strong>.
        </p>
        <HelpStep number={1} title="Vérifier l'envoi">
          <p>La fiche facture affiche les preuves liées : destinataire, date d'envoi, statut Resend, dernier événement reçu et accès au détail.</p>
        </HelpStep>
        <HelpStep number={2} title="Contrôler le contenu envoyé">
          <p>La preuve conserve l'empreinte SHA-256 du HTML de l'email et du PDF joint. Si le PDF est archivé dans Documents, le chemin de stockage est également conservé.</p>
        </HelpStep>
        <HelpStep number={3} title="Gérer les échecs et renvois">
          <p>Les statuts <strong>Rejeté</strong>, <strong>Plainte</strong>, <strong>Retardé</strong> ou <strong>Échec</strong> permettent d'identifier les emails à traiter. Un renvoi crée une nouvelle preuve sans modifier la date du premier envoi de la facture.</p>
        </HelpStep>
        <InfoBox type="info">
          Pour un contrôle ou un litige, exportez l'attestation PDF de la preuve ou le JSON complet depuis la page détail.
        </InfoBox>
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
        <p>
          Dans la situation du compte locataire, l'avoir apparaît au crédit et réduit le solde dû. Un avoir total peut solder la facture d'origine.
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
            <p>Depuis <strong>Facturation &gt; À traiter</strong>, la section <strong>Factures à envoyer</strong> permet l'envoi groupé des factures validées. Depuis la fiche d'une facture, utilisez <strong>Envoyer au locataire</strong> pour un envoi individuel.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment renvoyer une facture déjà envoyée ?</p>
            <p>Ouvrez la facture depuis l'onglet <strong>Factures</strong>, puis cliquez sur <strong>Renvoyer au locataire</strong>. La date du premier envoi est conservée, et le renvoi crée une nouvelle preuve d'envoi avec son propre statut de livraison.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Où trouver la preuve d'envoi d'une facture ou d'une quittance ?</p>
            <p>Depuis la fiche facture, consultez la carte <strong>Preuves d'envoi</strong>. Vous pouvez aussi ouvrir <strong>Documents &gt; Preuves d'envoi</strong> pour rechercher par destinataire, statut, période ou type de document.</p>
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
            <p>Cliquez sur l'onglet <strong>Relances</strong> sur la page Facturation. Il synthétise les factures en retard et ouvre le module Relances pour l'envoi et l'historique des relances.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Où voir la facturation d'un seul locataire ?</p>
            <p>Ouvrez la fiche du locataire. L'onglet <strong>Facturation</strong> liste ses pièces de facturation avec filtres, validation des brouillons et duplication, puis l'onglet <strong>Compte locataire</strong> affiche le solde détaillé avec paiements, avoirs et imports historiques.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Un import de relevé crée-t-il des factures ?</p>
            <p>Non. L'import d'un relevé d'ancien logiciel crée uniquement des mouvements historiques dans le compte locataire. Il ne consomme aucun numéro de facture et ne modifie pas la numérotation MyGestia.</p>
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
