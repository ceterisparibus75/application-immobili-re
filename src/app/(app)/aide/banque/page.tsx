import { Banknote } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Banque et comptabilité | Centre d'aide | ${APP_NAME}`,
};

export default function BanquePage() {
  return (
    <HelpPageLayout
      slug="banque"
      icon={<Banknote className="h-6 w-6" />}
      title="Banque et comptabilité"
      description="Connectez vos comptes bancaires, rapprochez les transactions et gérez votre comptabilité avec export FEC."
    >
      <HelpSection id="comptes" title="Gestion des comptes bancaires">
        <p>
          La page <strong>Banque</strong> affiche tous vos comptes bancaires sous forme de cartes, avec le solde actuel de chaque compte (vert si positif, rouge si négatif) et le nombre de transactions.
        </p>
        <HelpStep number={1} title="Ajouter un compte manuellement">
          <p>Cliquez sur <strong>Nouveau compte</strong>. Renseignez le nom du compte, le nom de la banque et l&apos;IBAN. Les données bancaires sont chiffrées (AES-256-GCM) pour une sécurité maximale.</p>
        </HelpStep>
        <HelpStep number={2} title="Connexion Open Banking (optionnel)">
          <p>Pour synchroniser automatiquement vos transactions, connectez votre compte via <strong>Connexion bancaire</strong>. L&apos;application utilise un service sécurisé (Powens) pour récupérer vos mouvements quotidiennement.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Liste des comptes bancaires" caption="Cartes des comptes avec solde, banque et nombre de transactions" />
        <InfoBox type="info">
          La synchronisation automatique s&apos;exécute chaque jour à 6h du matin. Vous pouvez aussi déclencher une synchronisation manuelle à tout moment.
        </InfoBox>
      </HelpSection>

      <HelpSection id="transactions" title="Transactions bancaires">
        <p>
          En cliquant sur un compte, vous accédez à l&apos;historique complet des transactions. Chaque transaction affiche la date, le libellé, le montant (débit en rouge, crédit en vert) et le statut de rapprochement.
        </p>
        <p>
          Vous pouvez filtrer les transactions par période, par montant et par statut (rapprochée, non rapprochée). La recherche par libellé est également disponible.
        </p>
        <ScreenshotPlaceholder alt="Historique des transactions" caption="Liste des transactions avec date, libellé, montant et statut" />
      </HelpSection>

      <HelpSection id="rapprochement" title="Rapprochement bancaire">
        <p>
          Le rapprochement bancaire consiste à associer chaque transaction bancaire à la facture ou l&apos;écriture comptable correspondante. Cela garantit la cohérence entre votre banque et votre comptabilité.
        </p>
        <HelpStep number={1} title="Accédez au rapprochement">
          <p>Depuis la fiche d&apos;un compte, cliquez sur <strong>Rapprochement</strong>. L&apos;écran se divise en deux colonnes : les transactions bancaires à gauche, les factures/écritures à droite.</p>
        </HelpStep>
        <HelpStep number={2} title="Associez les éléments">
          <p>Sélectionnez une transaction et la facture correspondante, puis cliquez sur <strong>Rapprocher</strong>. L&apos;application suggère automatiquement les correspondances possibles (basées sur le montant et la date).</p>
        </HelpStep>
        <HelpStep number={3} title="Vérifiez les écarts">
          <p>Si un écart existe entre le montant de la transaction et celui de la facture, un avertissement s&apos;affiche. Vous pouvez créer une écriture d&apos;ajustement.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Écran de rapprochement bancaire" caption="Interface de rapprochement avec transactions et factures côte à côte" />
      </HelpSection>

      <HelpSection id="comptabilite" title="Module comptabilité">
        <p>
          La page <strong>Comptabilité</strong> centralise toute votre tenue de comptes : écritures comptables, grand livre, balance, plan comptable et exports réglementaires.
        </p>
        <p>
          Des indicateurs en haut de page montrent : le nombre total d&apos;écritures, le nombre de brouillons (à valider), les écritures validées et le nombre de comptes actifs.
        </p>
        <ScreenshotPlaceholder alt="Page comptabilité" caption="Vue d'ensemble de la comptabilité avec KPI et accès rapides" />

        <p className="font-semibold text-foreground mt-6 mb-2">Accès rapides :</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Saisir une écriture", desc: "Créez une nouvelle écriture comptable (débit/crédit)" },
            { title: "Grand Livre", desc: "Consultez toutes les écritures classées par compte" },
            { title: "Balance", desc: "Vue synthétique des soldes de tous les comptes" },
            { title: "Plan comptable", desc: "Gérez la liste des comptes (code, libellé, type)" },
            { title: "Export FEC", desc: "Générez le Fichier des Écritures Comptables réglementaire" },
            { title: "Exercices", desc: "Gérez les exercices comptables (ouverture, clôture)" },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </HelpSection>

      <HelpSection id="ecritures" title="Écritures comptables">
        <p>
          Les écritures comptables suivent le principe de la partie double : chaque opération est enregistrée avec un débit et un crédit de même montant.
        </p>
        <p>
          Chaque écriture a un statut : <strong>Brouillon</strong> (modifiable), <strong>Validée</strong> (figée, prise en compte dans les rapports) ou <strong>Clôturée</strong> (exercice fermé).
        </p>
        <InfoBox type="warning">
          Les écritures en brouillon doivent être validées avant la clôture de l&apos;exercice. Une alerte s&apos;affiche si des brouillons existent au moment de la clôture.
        </InfoBox>
      </HelpSection>

      <HelpSection id="export-fec" title="Export FEC">
        <p>
          Le FEC (Fichier des Écritures Comptables) est un format réglementaire exigé par l&apos;administration fiscale française en cas de contrôle.
        </p>
        <HelpStep number={1} title="Accédez aux exports">
          <p>Allez dans <strong>Comptabilité &gt; Export FEC</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Sélectionnez la période">
          <p>Choisissez l&apos;exercice comptable ou la plage de dates à exporter.</p>
        </HelpStep>
        <HelpStep number={3} title="Téléchargez le fichier">
          <p>Cliquez sur <strong>Exporter</strong>. Le fichier est généré au format réglementaire (TXT tabulé) et téléchargé automatiquement.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Export FEC" caption="Interface d'export avec sélection de la période et bouton de téléchargement" />
      </HelpSection>

      <HelpSection id="exercices" title="Exercices comptables">
        <p>
          Un exercice comptable correspond généralement à une année civile (du 1er janvier au 31 décembre). Vous pouvez créer, ouvrir et clôturer des exercices.
        </p>
        <p>
          La clôture d&apos;un exercice fige toutes les écritures et génère les à-nouveaux pour l&apos;exercice suivant. Cette opération est irréversible : vérifiez bien que tous les brouillons sont validés avant de clôturer.
        </p>
        <ScreenshotPlaceholder alt="Gestion des exercices" caption="Liste des exercices avec dates, statut et actions (clôturer, ouvrir)" />
      </HelpSection>
    </HelpPageLayout>
  );
}
