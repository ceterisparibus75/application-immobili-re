import { UserCog } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Utilisateurs et droits d'accès | Centre d'aide | ${APP_NAME}`,
};

export default function UtilisateursPage() {
  return (
    <HelpPageLayout
      slug="utilisateurs"
      icon={<UserCog className="h-6 w-6" />}
      title="Utilisateurs et droits d'accès"
      description="Gérez les utilisateurs, les rôles et les permissions par société et par module pour un contrôle précis des accès."
    >
      <HelpSection id="roles" title="Les 5 rôles hiérarchiques">
        <p>
          Chaque utilisateur se voit attribuer un rôle par société. Les rôles sont hiérarchiques : un rôle supérieur inclut toutes les permissions des rôles inférieurs.
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2.5 font-semibold">Rôle</th>
                <th className="text-left px-4 py-2.5 font-semibold">Niveau</th>
                <th className="text-left px-4 py-2.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2.5 font-medium">Super Admin</td>
                <td className="px-4 py-2.5">50</td>
                <td className="px-4 py-2.5">Accès total à toutes les sociétés. Peut créer et supprimer des sociétés, gérer tous les utilisateurs et accéder à toutes les données sans restriction.</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Admin Société</td>
                <td className="px-4 py-2.5">40</td>
                <td className="px-4 py-2.5">Gestion complète d&apos;une société. Peut inviter des utilisateurs, modifier les paramètres de la société, et accéder à tous les modules de cette société.</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Gestionnaire</td>
                <td className="px-4 py-2.5">30</td>
                <td className="px-4 py-2.5">Gestion quotidienne du patrimoine. Peut créer et modifier les immeubles, lots, baux, locataires et factures. Ne peut pas gérer les utilisateurs.</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Comptable</td>
                <td className="px-4 py-2.5">20</td>
                <td className="px-4 py-2.5">Lecture sur tous les modules + écriture sur la facturation, la comptabilité, la banque et les relances. Idéal pour un comptable externe.</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium">Lecture seule</td>
                <td className="px-4 py-2.5">10</td>
                <td className="px-4 py-2.5">Consultation uniquement. Peut voir toutes les données mais ne peut rien créer, modifier ou supprimer.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ScreenshotPlaceholder alt="Liste des utilisateurs avec leurs rôles" caption="Chaque utilisateur a un rôle par société, affiché sous forme de badge coloré" src="/aide/screenshots/administration-main.png" />
      </HelpSection>

      <HelpSection id="permissions-modules" title="Permissions par module">
        <p>
          Les droits sont organisés en 3 niveaux par module : <strong>Lecture</strong> (consulter les données), <strong>Écriture</strong> (créer et modifier) et <strong>Suppression</strong> (supprimer des éléments).
        </p>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-semibold">Module</th>
                <th className="text-center px-2 py-2 font-semibold">Super Admin</th>
                <th className="text-center px-2 py-2 font-semibold">Admin</th>
                <th className="text-center px-2 py-2 font-semibold">Gestionnaire</th>
                <th className="text-center px-2 py-2 font-semibold">Comptable</th>
                <th className="text-center px-2 py-2 font-semibold">Lecture</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { module: "Patrimoine", sa: "LES", ad: "LES", ge: "LE", co: "L", le: "L" },
                { module: "Baux", sa: "LES", ad: "LES", ge: "LE", co: "L", le: "L" },
                { module: "Locataires", sa: "LES", ad: "LES", ge: "LE", co: "L", le: "L" },
                { module: "Facturation", sa: "LES", ad: "LES", ge: "LE", co: "LE", le: "L" },
                { module: "Comptabilité", sa: "LES", ad: "LES", ge: "L", co: "LE", le: "L" },
                { module: "Banque", sa: "LES", ad: "LES", ge: "L", co: "LE", le: "L" },
                { module: "Relances", sa: "LES", ad: "LES", ge: "LE", co: "LE", le: "L" },
                { module: "Charges", sa: "LES", ad: "LES", ge: "LE", co: "L", le: "L" },
                { module: "Documents", sa: "LES", ad: "LES", ge: "LE", co: "L", le: "L" },
                { module: "Dashboard", sa: "L", ad: "L", ge: "L", co: "L", le: "L" },
                { module: "Utilisateurs", sa: "LES", ad: "LES", ge: "\u2014", co: "\u2014", le: "\u2014" },
                { module: "Paramètres", sa: "LES", ad: "LE", ge: "\u2014", co: "\u2014", le: "\u2014" },
              ].map((row) => (
                <tr key={row.module}>
                  <td className="px-3 py-2 font-medium">{row.module}</td>
                  <td className="px-2 py-2 text-center">{row.sa}</td>
                  <td className="px-2 py-2 text-center">{row.ad}</td>
                  <td className="px-2 py-2 text-center">{row.ge}</td>
                  <td className="px-2 py-2 text-center">{row.co}</td>
                  <td className="px-2 py-2 text-center">{row.le}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-2">
          L = Lecture, E = Écriture, S = Suppression. Exemple : &laquo; LE &raquo; signifie Lecture + Écriture.
        </p>
        <InfoBox type="info">
          Un administrateur peut personnaliser les droits module par module pour chaque utilisateur. Par exemple, donner l&apos;accès écriture en facturation à un utilisateur en lecture seule.
        </InfoBox>
      </HelpSection>

      <HelpSection id="ajouter-utilisateur" title="Ajouter un utilisateur">
        <HelpStep number={1} title="Accédez à la gestion des utilisateurs">
          <p>Depuis le menu déroulant utilisateur en haut à droite, cliquez sur <strong>Utilisateurs</strong>, ou allez dans <strong>Administration &gt; Utilisateurs</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Créez le nouvel utilisateur">
          <p>Cliquez sur <strong>Créer un utilisateur</strong>. Renseignez l&apos;email, le nom et le prénom. Un mot de passe temporaire sera envoyé automatiquement par email.</p>
        </HelpStep>
        <HelpStep number={3} title="Attribuez un rôle">
          <p>Sélectionnez le rôle de l&apos;utilisateur pour la société courante. Vous pouvez aussi l&apos;ajouter à d&apos;autres sociétés avec des rôles différents.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Formulaire de création d'utilisateur" caption="Formulaire avec email, nom, prénom et sélection du rôle" src="/aide/screenshots/administration-main.png" />
        <InfoBox type="warning">
          Le nombre d&apos;utilisateurs est limité selon votre plan d&apos;abonnement. Vérifiez votre quota dans Mon compte &gt; Abonnement.
        </InfoBox>
      </HelpSection>

      <HelpSection id="acces-proprietaire" title="Accès aux propriétaires">
        <p>
          L&apos;accès aux propriétaires est <strong>automatique et indirect</strong>. Un utilisateur voit le propriétaire de chaque société dont il est membre, sans avoir besoin d&apos;un accès direct.
        </p>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Marie est gestionnaire de la SCI Soleil (rattachée au propriétaire Jean Dupont) et administratrice de la SARL Horizon (rattachée au propriétaire Groupe Horizon).
            Elle voit automatiquement les deux propriétaires dans sa barre de navigation et peut consulter leurs fiches respectives.
          </p>
        </div>
        <ScreenshotPlaceholder alt="Sélecteur de propriétaire dans la barre de navigation" caption="Le sélecteur affiche les propriétaires accessibles via les sociétés de l'utilisateur" src="/aide/screenshots/administration-main.png" />
        <InfoBox type="info">
          Seuls les créateurs du propriétaire et les utilisateurs Admin Société ou Super Admin peuvent modifier les informations d&apos;un propriétaire (fiche, co-propriétaires, etc.).
        </InfoBox>
      </HelpSection>

      <HelpSection id="multi-societe" title="Gestion multi-société">
        <p>
          Un même utilisateur peut être membre de plusieurs sociétés avec des rôles différents. Par exemple, Admin sur la SCI A et Comptable sur la SARL B.
        </p>
        <p>
          Le sélecteur de société dans la barre de navigation permet de basculer d&apos;une société à l&apos;autre. Toutes les données affichées (immeubles, locataires, factures, etc.) sont automatiquement filtrées selon la société active.
        </p>
        <ScreenshotPlaceholder alt="Sélecteur de société" caption="Basculez entre vos sociétés via le menu déroulant dans la barre du haut" src="/aide/screenshots/administration-main.png" />
      </HelpSection>
    </HelpPageLayout>
  );
}
