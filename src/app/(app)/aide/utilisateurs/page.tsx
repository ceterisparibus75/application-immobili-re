import { UserCog } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

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
                <td className="px-4 py-2.5">Gestion complète d'une société. Peut inviter des utilisateurs, modifier les paramètres de la société, et accéder à tous les modules de cette société.</td>
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
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Votre comptable externe, Sophie Martin, a le rôle Comptable. Elle peut consulter tous les modules (Lecture) mais ne peut créer ou modifier que dans Facturation, Comptabilité, Banque et Relances (Écriture). Si vous souhaitez qu'elle puisse aussi gérer les charges, personnalisez ses permissions module par module depuis sa fiche utilisateur.
          </p>
        </div>
        <InfoBox type="info">
          Un administrateur peut personnaliser les droits module par module pour chaque utilisateur. Par exemple, donner l'accès écriture en facturation à un utilisateur en lecture seule.
        </InfoBox>
      </HelpSection>

      <HelpSection id="ajouter-utilisateur" title="Ajouter un utilisateur">
        <HelpStep number={1} title="Accédez à la gestion des utilisateurs">
          <p>Depuis le menu déroulant utilisateur en haut à droite, cliquez sur <strong>Utilisateurs</strong>, ou allez dans <strong>Administration &gt; Utilisateurs</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Créez le nouvel utilisateur">
          <p>Cliquez sur <strong>Créer un utilisateur</strong>. Renseignez l'email, le nom et le prénom. Un mot de passe temporaire sera envoyé automatiquement par email.</p>
        </HelpStep>
        <HelpStep number={3} title="Attribuez un rôle">
          <p>Sélectionnez le rôle de l'utilisateur pour la société courante. Vous pouvez aussi l'ajouter à d'autres sociétés avec des rôles différents.</p>
        </HelpStep>
        <InfoBox type="warning">
          Le nombre d'utilisateurs est limité selon votre plan d'abonnement. Vérifiez votre quota dans Mon compte &gt; Abonnement.
        </InfoBox>
      </HelpSection>

      <HelpSection id="acces-proprietaire" title="Accès aux propriétaires">
        <p>
          L'accès aux propriétaires est <strong>automatique et indirect</strong>. Un utilisateur voit le propriétaire de chaque société dont il est membre, sans avoir besoin d'un accès direct.
        </p>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Marie est gestionnaire de la SCI Soleil (rattachée au propriétaire Jean Dupont) et administratrice de la SARL Horizon (rattachée au propriétaire Groupe Horizon).
            Elle voit automatiquement les deux propriétaires dans sa barre de navigation et peut consulter leurs fiches respectives.
          </p>
        </div>
        <InfoBox type="info">
          Seuls les créateurs du propriétaire et les utilisateurs Admin Société ou Super Admin peuvent modifier les informations d'un propriétaire (fiche, co-propriétaires, etc.).
        </InfoBox>
      </HelpSection>

      <HelpSection id="multi-societe" title="Gestion multi-société">
        <p>
          Un même utilisateur peut être membre de plusieurs sociétés avec des rôles différents. Par exemple, Admin sur la SCI A et Comptable sur la SARL B.
        </p>
        <p>
          Le sélecteur de société dans la barre de navigation permet de basculer d'une société à l'autre. Toutes les données affichées (immeubles, locataires, factures, etc.) sont automatiquement filtrées selon la société active.
        </p>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur les utilisateurs">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Un utilisateur peut-il avoir des rôles différents selon la société ?</p>
            <p>Oui, le rôle est attribué par société. Un même utilisateur peut par exemple être Admin Société sur la SCI A et Comptable sur la SARL B.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment réinitialiser le mot de passe d'un utilisateur ?</p>
            <p>L'utilisateur doit cliquer sur &laquo; Mot de passe oublié &raquo; sur la page de connexion. Il recevra un email avec un lien pour définir un nouveau mot de passe.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Combien d'utilisateurs puis-je créer ?</p>
            <p>Le nombre d'utilisateurs dépend de votre plan d'abonnement : Starter permet 2 utilisateurs, Pro en permet 5 et Enterprise offre un nombre illimité. Consultez Mon compte &gt; Abonnement pour vérifier votre quota.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment supprimer un utilisateur ?</p>
            <p>Rendez-vous dans Administration &gt; Utilisateurs, cliquez sur l'utilisateur concerné puis sur le bouton Supprimer. Ses données (logs d'audit, actions passées) restent dans le système pour la traçabilité.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Un comptable externe peut-il accéder à l'application ?</p>
            <p>Oui, créez un utilisateur avec le rôle Comptable. Il aura accès en lecture sur tous les modules et en écriture sur la facturation, la comptabilité, la banque et les relances.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment personnaliser les droits d'un utilisateur par module ?</p>
            <p>Depuis la fiche de l'utilisateur, rendez-vous dans la section Permissions. Vous pouvez cocher les droits par module : Lecture, Écriture et Suppression, indépendamment du rôle global.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Que voit un utilisateur en lecture seule ?</p>
            <p>Un utilisateur avec le rôle Lecture seule peut consulter toutes les données de la société (immeubles, locataires, baux, factures, etc.) mais ne peut rien créer, modifier ou supprimer.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Le propriétaire de la société a-t-il toujours tous les droits ?</p>
            <p>Oui, le créateur de la société (owner) a automatiquement un accès complet à toutes les fonctionnalités, quels que soient les paramètres de rôle ou de permissions configurés.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment savoir qui a fait quoi dans l'application ?</p>
            <p>Rendez-vous dans Administration &gt; Audit. Le journal d'activité affiche chaque action avec la date, l'utilisateur concerné, le type d'action et l'entité modifiée.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je désactiver temporairement un utilisateur sans le supprimer ?</p>
            <p>Pour le moment, il n'existe pas de fonction de désactivation. Vous pouvez cependant changer son rôle en Lecture seule pour limiter ses actions en attendant.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
