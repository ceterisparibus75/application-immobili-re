import { FolderLock } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Documents, Dataroom et signatures | Centre d'aide | ${APP_NAME}`,
};

export default function DocumentsPage() {
  return (
    <HelpPageLayout
      slug="documents"
      icon={<FolderLock className="h-6 w-6" />}
      title="Documents, Dataroom et signatures"
      description="Stockez, organisez, partagez et faites signer vos documents en toute sécurité."
    >
      <HelpSection id="stockage" title="Stockage sécurisé des documents">
        <p>
          {APP_NAME} offre un espace de stockage sécurisé pour tous vos documents immobiliers. Les fichiers sont hébergés sur Supabase Storage (infrastructure européenne) et accessibles via des URLs signées à durée limitée.
        </p>
        <p>
          Les documents peuvent être rattachés à différentes entités : immeuble, lot, bail, locataire ou société. Ils sont automatiquement classés par catégorie.
        </p>

        <p className="font-semibold text-foreground mt-6 mb-2">Catégories de documents :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Baux et avenants</strong> : contrats de location signés</li>
          <li><strong>Diagnostics</strong> : DPE, amiante, plomb, gaz, électricité, etc.</li>
          <li><strong>Factures et quittances</strong> : factures émises et quittances de loyer</li>
          <li><strong>Pièces d'identité</strong> : copies des pièces des locataires</li>
          <li><strong>Assurances</strong> : attestations d'assurance (propriétaire et locataire)</li>
          <li><strong>États des lieux</strong> : rapports d'entrée et de sortie</li>
          <li><strong>Courriers</strong> : correspondances officielles</li>
          <li><strong>Comptabilité</strong> : relevés bancaires, FEC, bilans</li>
          <li><strong>Autres</strong> : tout document ne rentrant pas dans les catégories précédentes</li>
        </ul>
      </HelpSection>

      <HelpSection id="upload" title="Ajouter un document">
        <HelpStep number={1} title="Choisissez l'entité">
          <p>Depuis la fiche d'un immeuble, d'un bail ou d'un locataire, accédez à la section <strong>Documents</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Uploadez le fichier">
          <p>Cliquez sur <strong>Ajouter un document</strong>. Sélectionnez le fichier sur votre ordinateur (PDF, JPG, PNG, DOCX acceptés). La taille maximale est de 20 Mo par fichier.</p>
        </HelpStep>
        <HelpStep number={3} title="Renseignez les métadonnées">
          <p>Donnez un nom au document, sélectionnez la catégorie et, si applicable, la date d'expiration. Les documents avec date d'expiration déclenchent des alertes automatiques.</p>
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
          <li><strong>Par catégorie</strong> : filtrez par type de document (diagnostics, baux, factures, etc.)</li>
          <li><strong>Par recherche</strong> : utilisez la barre de recherche globale pour retrouver un document par son nom</li>
          <li><strong>Par expiration</strong> : les documents arrivant à expiration sont signalés par un badge orange ou rouge</li>
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
          <li><strong>Audit trail</strong> : chaque consultation et téléchargement est enregistré dans les logs d'activité</li>
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
            <p>Utilisez la recherche globale (Ctrl+K), filtrez par catégorie ou par entité (immeuble, bail, locataire). Les documents arrivant à expiration sont également signalés par un badge.</p>
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
