import { Shield } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Sécurité et confidentialité | Centre d'aide | ${APP_NAME}`,
};

export default function SecuritePage() {
  return (
    <HelpPageLayout
      slug="securite"
      icon={<Shield className="h-6 w-6" />}
      title="Sécurité et confidentialité"
      description="Protection des données, RGPD, authentification à deux facteurs et portail locataire sécurisé."
    >
      <HelpSection id="chiffrement" title="Chiffrement des données sensibles">
        <p>
          {APP_NAME} applique un chiffrement fort sur toutes les données sensibles :
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Données bancaires (IBAN/BIC)</p>
            <p>Chiffrées en <strong>AES-256-GCM</strong>, le standard le plus sûr. Les données ne sont déchiffrées qu&apos;au moment de l&apos;affichage ou de la génération de factures, jamais stockées en clair.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Mots de passe</p>
            <p>Hachés avec <strong>bcrypt</strong> (12 rounds). Même en cas de fuite de la base de données, les mots de passe ne peuvent pas être retrouvés.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Sessions</p>
            <p>Tokens JWT signés avec durée limitée à 24 heures. Les sessions expirent automatiquement et nécessitent une nouvelle connexion.</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="2fa" title="Authentification à deux facteurs (2FA)">
        <p>
          L&apos;authentification à deux facteurs ajoute une couche de sécurité supplémentaire à votre compte. Même si quelqu&apos;un obtient votre mot de passe, il ne pourra pas se connecter sans le code 2FA.
        </p>
        <HelpStep number={1} title="Activez la 2FA">
          <p>Allez dans <strong>Paramètres &gt; Sécurité</strong>. Cliquez sur <strong>Activer la 2FA</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Scannez le QR code">
          <p>Un QR code s&apos;affiche. Scannez-le avec une application d&apos;authentification (Google Authenticator, Authy, Microsoft Authenticator, etc.).</p>
        </HelpStep>
        <HelpStep number={3} title="Confirmez avec un code">
          <p>Entrez le code à 6 chiffres affiché par votre application pour confirmer l&apos;activation. Conservez précieusement vos codes de récupération.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Activation 2FA" caption="QR code à scanner avec l'application d'authentification" src="/aide/screenshots/compte-main.png" />
        <InfoBox type="warning">
          Si vous perdez l&apos;accès à votre application d&apos;authentification, les codes de récupération sont le seul moyen de vous reconnecter. Notez-les dans un endroit sûr.
        </InfoBox>
      </HelpSection>

      <HelpSection id="securite-web" title="Sécurité de l'application web">
        <p>
          L&apos;application applique automatiquement de nombreuses protections :
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>HTTPS obligatoire</strong> : toutes les communications sont chiffrées en transit</li>
          <li><strong>HSTS</strong> : force le navigateur à toujours utiliser HTTPS</li>
          <li><strong>CSP (Content Security Policy)</strong> : empêche l&apos;injection de scripts malveillants</li>
          <li><strong>X-Frame-Options DENY</strong> : interdit l&apos;intégration de l&apos;application dans une iframe (protection clickjacking)</li>
          <li><strong>Rate limiting</strong> : limite le nombre de requêtes par seconde pour prévenir les attaques par force brute (3 tentatives de connexion par 10 secondes, 10 requêtes API par 10 secondes)</li>
          <li><strong>Nonce CSP</strong> : chaque page génère un jeton unique pour les scripts inline</li>
        </ul>
      </HelpSection>

      <HelpSection id="rgpd" title="Conformité RGPD">
        <p>
          {APP_NAME} est conforme au Règlement Général sur la Protection des Données (RGPD). Un module dédié est accessible depuis <strong>RGPD</strong> dans le menu.
        </p>

        <p className="font-semibold text-foreground mt-4 mb-2">Droits des personnes :</p>
        <p>
          Le module RGPD permet de gérer les demandes d&apos;exercice de droits des locataires et utilisateurs :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Droit d&apos;accès</strong> : le locataire demande à connaître les données le concernant</li>
          <li><strong>Droit de rectification</strong> : correction des données inexactes</li>
          <li><strong>Droit de suppression</strong> : effacement des données (dans les limites légales)</li>
          <li><strong>Droit de portabilité</strong> : export des données dans un format lisible</li>
          <li><strong>Droit d&apos;opposition</strong> : opposition au traitement de certaines données</li>
        </ul>
        <ScreenshotPlaceholder alt="Module RGPD" caption="Tableau des demandes RGPD avec type, statut et date" src="/aide/screenshots/rgpd-main.png" />

        <p className="font-semibold text-foreground mt-6 mb-2">Registre des traitements :</p>
        <p>
          Le registre documente tous les traitements de données personnelles effectués par l&apos;application : finalité, durée de conservation, base légale et catégories de données.
        </p>

        <p className="font-semibold text-foreground mt-6 mb-2">Durées de conservation :</p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2.5 font-semibold">Type de données</th>
                <th className="text-left px-4 py-2.5 font-semibold">Durée</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="px-4 py-2">Locataire actif</td><td className="px-4 py-2">Durée du bail</td></tr>
              <tr><td className="px-4 py-2">Locataire archivé</td><td className="px-4 py-2">5 ans après fin de bail</td></tr>
              <tr><td className="px-4 py-2">Pièces d&apos;identité</td><td className="px-4 py-2">3 ans après fin de relation</td></tr>
              <tr><td className="px-4 py-2">Données bancaires</td><td className="px-4 py-2">10 ans (obligation légale)</td></tr>
              <tr><td className="px-4 py-2">Logs d&apos;activité</td><td className="px-4 py-2">1 an</td></tr>
              <tr><td className="px-4 py-2">Consentements</td><td className="px-4 py-2">3 ans après révocation</td></tr>
            </tbody>
          </table>
        </div>
      </HelpSection>

      <HelpSection id="portail" title="Portail locataire">
        <p>
          Chaque locataire dispose d&apos;un <strong>portail personnel sécurisé</strong> accessible via un lien individuel. Le locataire n&apos;a pas besoin de créer de compte {APP_NAME}.
        </p>
        <p>
          Depuis son portail, le locataire peut :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Consulter ses factures et quittances</li>
          <li>Télécharger ses documents (bail, états des lieux, diagnostics)</li>
          <li>Voir le détail de ses charges</li>
          <li>Consulter son attestation d&apos;assurance</li>
          <li>Effectuer des paiements en ligne</li>
        </ul>
        <ScreenshotPlaceholder alt="Portail locataire" caption="Vue du portail locataire avec factures, documents et paiements" src="/aide/screenshots/compte-main.png" />
        <InfoBox type="info">
          Le portail locataire utilise une authentification JWT séparée, distincte de l&apos;authentification des utilisateurs de l&apos;application. Le locataire accède uniquement à ses propres données.
        </InfoBox>
      </HelpSection>

      <HelpSection id="audit" title="Logs d'activité et audit">
        <p>
          Toutes les actions effectuées dans l&apos;application sont enregistrées dans un journal d&apos;audit : création, modification, suppression, consultation de données sensibles, envoi d&apos;emails, connexions, etc.
        </p>
        <p>
          Les logs sont accessibles depuis <strong>Mon compte &gt; Activité</strong> ou depuis <strong>Administration &gt; Audit</strong> (pour les administrateurs). Ils sont conservés pendant 1 an conformément au RGPD.
        </p>
        <p>
          Chaque entrée du journal contient : la date et l&apos;heure, l&apos;utilisateur, l&apos;action effectuée, l&apos;entité concernée et les détails de la modification.
        </p>
        <ScreenshotPlaceholder alt="Journal d'audit" caption="Historique des actions avec utilisateur, date, type d'action et entité" src="/aide/screenshots/administration-main.png" />
      </HelpSection>

      <HelpSection id="hebergement" title="Hébergement et infrastructure">
        <p>
          L&apos;application est hébergée sur une infrastructure européenne conforme au RGPD :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Base de données</strong> : Supabase PostgreSQL (Frankfurt, Allemagne)</li>
          <li><strong>Fichiers</strong> : Supabase Storage (Frankfurt, Allemagne)</li>
          <li><strong>Application</strong> : Vercel (Edge Network Europe)</li>
          <li><strong>Cache</strong> : Upstash Redis (Frankfurt, Allemagne)</li>
          <li><strong>Monitoring</strong> : Sentry (serveurs européens)</li>
        </ul>
        <InfoBox type="info">
          Toutes les données restent en Europe. Aucun transfert de données hors UE n&apos;est effectué.
        </InfoBox>
      </HelpSection>
    </HelpPageLayout>
  );
}
