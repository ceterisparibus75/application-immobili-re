import { FolderLock } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

import { APP_NAME } from "@/lib/constants";

export const metadata = {
  title: `Documents, preuves et signatures | Centre d'aide | ${APP_NAME}`,
};

export default function DocumentsPage() {
  return (
    <HelpPageLayout
      slug="documents"
      icon={<FolderLock className="h-6 w-6" />}
      title="Documents, Dataroom, preuves d'envoi et signatures"
      description="Stockez, organisez, partagez, prouvez vos envois et faites signer vos documents en toute sécurité."
    >
      <HelpSection id="stockage" title="Stockage sécurisé des documents">
        <p>
          {APP_NAME} offre un espace de stockage sécurisé pour tous vos documents immobiliers. Les fichiers sont hébergés sur Supabase Storage (infrastructure européenne) et accessibles via des URLs signées à durée limitée.
        </p>
        <p>
          Les documents peuvent être rattachés à différentes entités : immeuble, lot, bail, locataire ou société. Ils sont automatiquement classés par catégorie.
        </p>
        <p>
          Depuis une fiche locataire, le bloc <strong>Documents</strong> permet d'ouvrir directement les documents filtrés sur ce locataire ou d'ajouter un nouveau document déjà pré-rattaché.
        </p>

        <p className="font-semibold text-foreground mt-6 mb-2">Catégories de documents :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Patrimoine</strong> : titres de propriété, actes d'acquisition, plans, diagnostics, permis et autorisations de travaux</li>
          <li><strong>Location</strong> : baux, avenants, états des lieux et quittances</li>
          <li><strong>Juridique société</strong> : statuts, PV d'assemblée, Kbis, mandats de gestion et règlements de copropriété</li>
          <li><strong>Financier</strong> : comptes annuels, liasses fiscales, budgets, expertises et factures</li>
          <li><strong>Assurance</strong> : attestations locataires, polices immeuble et attestations décennales</li>
          <li><strong>Administratif</strong> : contrats prestataires, courriers, correspondances et autres documents</li>
        </ul>
      </HelpSection>

      <HelpSection id="upload" title="Ajouter un document">
        <HelpStep number={1} title="Choisissez l'entité">
          <p>Depuis la fiche d'un immeuble, d'un bail ou d'un locataire, accédez à la section <strong>Documents</strong>. Sur une fiche locataire, le bouton <strong>Ajouter un document</strong> ouvre le formulaire avec le locataire déjà sélectionné.</p>
        </HelpStep>
        <HelpStep number={2} title="Uploadez le fichier">
          <p>Cliquez sur <strong>Ajouter un document</strong>. Sélectionnez le fichier sur votre ordinateur (PDF, JPG, PNG, DOCX acceptés). La taille maximale est de 20 Mo par fichier.</p>
        </HelpStep>
        <HelpStep number={3} title="Renseignez les métadonnées">
          <p>Donnez un nom au document, sélectionnez la catégorie groupée et, si applicable, la date d'expiration. Vous pouvez aussi ajouter des tags pour faciliter la recherche. Les documents avec date d'expiration déclenchent des alertes automatiques.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous recevez le DPE de l'immeuble &laquo; Résidence les Acacias &raquo; au format PDF. Depuis la fiche immeuble &gt; Documents, cliquez sur Ajouter, uploadez le fichier &laquo; DPE_Acacias_2026.pdf &raquo;, catégorie &laquo; Diagnostic &raquo;, date d'expiration 15/04/2036. Le document est stocké, un badge vert &laquo; Valide &raquo; s'affiche. Dans 9 ans et 9 mois, un badge orange &laquo; Expire bientôt &raquo; vous alertera.
          </p>
        </div>
        <InfoBox type="tip">
          Les documents sont uploadés via des URLs signées (upload direct vers le stockage sécurisé), ce qui garantit que le fichier ne transite jamais par nos serveurs applicatifs.
        </InfoBox>
      </HelpSection>

      <HelpSection id="preuves-envoi" title="Preuves d'envoi et attestations">
        <p>
          Le registre <strong>Documents &gt; Preuves d'envoi</strong> centralise les preuves des emails importants : factures, quittances, décomptes annuels de charges, courriers et relances.
        </p>
        <p>
          Chaque preuve conserve le destinataire, le sujet, la date d'envoi, l'identifiant Resend, le statut de livraison, l'empreinte du contenu HTML envoyé et, lorsqu'une pièce jointe existe, l'empreinte du PDF envoyé.
        </p>
        <HelpStep number={1} title="Suivre le statut">
          <p>Les cartes de synthèse indiquent les emails envoyés, livrés, retardés, rejetés, en plainte ou échoués. Les filtres permettent d'isoler un statut, un module métier, un destinataire ou une période.</p>
        </HelpStep>
        <HelpStep number={2} title="Consulter une preuve">
          <p>La page détail affiche l'historique complet des événements Resend, les horodatages, les empreintes SHA-256, le contexte métier lié et les preuves associées au même document ou au même destinataire.</p>
        </HelpStep>
        <HelpStep number={3} title="Exporter le dossier de preuve">
          <p>Vous pouvez exporter une attestation PDF pour un envoi précis, un export JSON complet avec les données techniques ou un export CSV filtré pour un audit global.</p>
        </HelpStep>
        <InfoBox type="info">
          Les payloads webhook Resend sont conservés avec leur propre empreinte. Cela permet de prouver que le statut affiché provient bien d'un événement reçu et horodaté.
        </InfoBox>
      </HelpSection>

      <HelpSection id="dataroom" title="Dataroom partagée">
        <p>
          La <strong>Dataroom</strong> est un espace de partage sécurisé destiné à vos partenaires externes : banques, notaires, acquéreurs potentiels, experts-comptables.
        </p>
        <HelpStep number={1} title="Créez un lien de partage">
          <p>Depuis les documents d'un immeuble ou d'une société, sélectionnez les documents à partager et cliquez sur <strong>Créer un lien Dataroom</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Configurez l'accès">
          <p>Définissez la durée de validité du lien (7 jours, 30 jours, etc.) et un éventuel mot de passe. Le destinataire pourra consulter et télécharger les documents sans se connecter à {APP_NAME}.</p>
        </HelpStep>
        <HelpStep number={3} title="Partagez le lien">
          <p>Copiez le lien et envoyez-le à votre interlocuteur par email ou messagerie. Vous pouvez révoquer l'accès à tout moment.</p>
        </HelpStep>
        <InfoBox type="warning">
          Le destinataire de la Dataroom n'a accès qu'aux documents que vous avez explicitement sélectionnés. Il ne peut pas naviguer dans l'application ni voir d'autres données.
        </InfoBox>
      </HelpSection>

      <HelpSection id="signatures" title="Signatures électroniques">
        <p>
          {APP_NAME} intègre un module de signature électronique pour faire signer vos documents directement dans l'application : baux, avenants, mandats SEPA, états des lieux, etc.
        </p>
        <HelpStep number={1} title="Préparez le document">
          <p>Uploadez le document à signer (PDF). Indiquez les zones de signature pour chaque signataire.</p>
        </HelpStep>
        <HelpStep number={2} title="Envoyez pour signature">
          <p>Renseignez l'email des signataires. Chaque personne reçoit un lien sécurisé pour signer le document depuis son navigateur, sans créer de compte.</p>
        </HelpStep>
        <HelpStep number={3} title="Suivez l'avancement">
          <p>L'état de chaque signature est visible en temps réel : en attente, signé, refusé. Une fois tous les signataires ayant signé, le document final est archivé automatiquement.</p>
        </HelpStep>
      </HelpSection>

      <HelpSection id="organisation" title="Organisation et recherche">
        <p>
          Les documents sont automatiquement organisés par entité (immeuble, bail, locataire) et par catégorie. Vous pouvez les retrouver de plusieurs façons :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Par entité</strong> : depuis la fiche d'un immeuble, bail ou locataire, section Documents</li>
          <li><strong>Par locataire</strong> : depuis la fiche locataire, cliquez sur <strong>Voir les documents</strong> pour ouvrir la GED filtrée sur ce locataire</li>
          <li><strong>Par catégorie</strong> : filtrez par thème puis par type de document (diagnostic, bail, facture, assurance, etc.)</li>
          <li><strong>Par recherche</strong> : utilisez la barre de recherche globale ou la recherche plein texte pour retrouver un document par son nom, ses tags ou son contenu indexé</li>
          <li><strong>Par expiration</strong> : les documents arrivant à expiration sont signalés par un badge orange ou rouge</li>
          <li><strong>Par version</strong> : remplacez un fichier tout en conservant l'historique des versions précédentes</li>
          <li><strong>Par sélection multiple</strong> : appliquez des actions de masse aux documents cochés</li>
        </ul>
      </HelpSection>

      <HelpSection id="securite" title="Sécurité des documents">
        <p>
          La sécurité de vos documents est assurée par plusieurs mécanismes :
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Stockage chiffré</strong> : les fichiers sont stockés sur une infrastructure européenne sécurisée (Supabase Frankfurt)</li>
          <li><strong>URLs signées</strong> : les liens de téléchargement expirent après 5 minutes pour empêcher le partage non autorisé</li>
          <li><strong>Contrôle d'accès</strong> : seuls les utilisateurs ayant accès à la société peuvent voir les documents</li>
          <li><strong>Audit trail</strong> : chaque consultation, téléchargement et preuve d'envoi est enregistré dans les logs d'activité</li>
          <li><strong>Empreintes cryptographiques</strong> : les preuves d'envoi conservent les empreintes SHA-256 des contenus envoyés et des payloads webhook reçus</li>
          <li><strong>Dataroom isolée</strong> : les partenaires externes ne voient que les documents explicitement partagés</li>
        </ul>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur les documents">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Quels formats de fichiers sont acceptés ?</p>
            <p>PDF, JPG, PNG, DOCX et XLSX. La taille maximale est de 20 Mo par fichier.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment partager des documents avec un notaire ou une banque ?</p>
            <p>Créez un lien Dataroom avec les documents sélectionnés. Le lien peut avoir un mot de passe et une durée de validité limitée. Le destinataire consulte les fichiers sans se connecter à {APP_NAME}.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment fonctionne la signature électronique ?</p>
            <p>Uploadez un PDF, définissez les zones de signature pour chaque signataire, puis envoyez-le par email. Les signataires signent directement depuis leur navigateur sans créer de compte.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">La signature électronique a-t-elle une valeur légale ?</p>
            <p>Oui, la signature électronique est reconnue par la loi française et européenne (règlement eIDAS). Elle a la même valeur qu'une signature manuscrite.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment retrouver un document précis ?</p>
            <p>Utilisez la recherche globale (Ctrl+K), filtrez par catégorie, par tag ou par entité (immeuble, bail, locataire). Les documents arrivant à expiration sont également signalés par un badge.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment prouver qu'un email important a été envoyé ?</p>
            <p>Ouvrez <strong>Documents &gt; Preuves d'envoi</strong>, filtrez par destinataire, module ou période, puis ouvrez la preuve. Vous pouvez télécharger une attestation PDF ou un export JSON détaillé.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Les documents sont-ils sauvegardés automatiquement ?</p>
            <p>Oui, ils sont stockés sur une infrastructure européenne sécurisée (Supabase Frankfurt) avec redondance. Aucune sauvegarde manuelle n'est nécessaire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment révoquer l'accès à une Dataroom ?</p>
            <p>Depuis la page Dataroom, cliquez sur le lien de partage et supprimez-le. L'accès est immédiatement révoqué pour le destinataire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je classer automatiquement mes documents ?</p>
            <p>Oui, l'analyse IA (plan Enterprise) catégorise automatiquement les documents uploadés en 9 catégories : bail, avenant, quittance, facture, diagnostic, assurance, titre de propriété, contrat et état des lieux.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
