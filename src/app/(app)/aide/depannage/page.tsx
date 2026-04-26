import { Wrench } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Problèmes fréquents et solutions | Centre d'aide | ${APP_NAME}`,
};

export default function DepannagePage() {
  return (
    <HelpPageLayout
      slug="depannage"
      icon={<Wrench className="h-6 w-6" />}
      title="Problèmes fréquents et solutions"
      description="Solutions aux problèmes les plus courants : connexion, emails, factures, banque, portail locataire et bien d'autres."
    >
      <InfoBox type="info">
        Si votre problème n'est pas listé ici ou si la solution proposée ne fonctionne pas, contactez le support via le bouton &laquo; Contacter le support &raquo; en bas de page — nous répondons en moins de 4 heures ouvrées.
      </InfoBox>

      <HelpSection id="connexion" title="Problèmes de connexion">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Mon compte est verrouillé</p>
            <p className="text-sm mb-3">
              Après 5 tentatives de connexion échouées, le compte est verrouillé automatiquement pendant 15 minutes. C'est une mesure de sécurité.
            </p>
            <p className="text-sm font-medium text-foreground mb-1">Solution :</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Attendez 15 minutes, puis retentez la connexion.</li>
              <li>Si vous avez oublié votre mot de passe, cliquez sur <strong>Mot de passe oublié</strong> sur la page de connexion.</li>
              <li>Vérifiez que votre clavier n'est pas en majuscules (Caps Lock).</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Je ne reçois pas l&apos;email de réinitialisation de mot de passe</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez votre dossier <strong>Spam / Courrier indésirable</strong>.</li>
              <li>L&apos;email est envoyé depuis <strong>no-reply@mygestia.fr</strong> — ajoutez cette adresse à vos contacts.</li>
              <li>Patientez 5 minutes (délai de livraison des emails).</li>
              <li>Vérifiez que vous avez saisi la bonne adresse email (celle utilisée lors de la création du compte).</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Je suis déconnecté automatiquement</p>
            <p className="text-sm mb-2">
              L&apos;application déconnecte automatiquement les sessions inactives après 10 minutes. Un avertissement apparaît 1 minute avant la déconnexion.
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Si vous travaillez longtemps sur un formulaire, enregistrez régulièrement.</li>
              <li>La session expire également après 24 heures quelle que soit l&apos;activité.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Mon code de double authentification (2FA) ne fonctionne pas</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez que l&apos;heure de votre téléphone est correcte (la 2FA est sensible à l&apos;heure exacte).</li>
              <li>Essayez le code suivant — les codes changent toutes les 30 secondes.</li>
              <li>Si vous avez perdu accès à votre application d&apos;authentification, utilisez un <strong>code de récupération</strong> (format XXXXX-XXXXX) sauvegardé lors de l&apos;activation du 2FA.</li>
              <li>En dernier recours, contactez le support avec votre adresse email et une preuve d&apos;identité pour désactiver le 2FA.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="emails" title="Problèmes d'emails">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Les emails de relance ou de facture ne sont pas reçus par mes locataires</p>
            <HelpStep number={1} title="Vérifiez l'adresse email du locataire">
              <p>Dans la fiche locataire, vérifiez que l&apos;adresse email est correctement saisie et qu&apos;il n&apos;y a pas de faute de frappe.</p>
            </HelpStep>
            <HelpStep number={2} title="Vérifiez la configuration email de votre société">
              <p>Allez dans <strong>Paramètres &gt; Société</strong> et vérifiez que les champs <strong>Email de contact</strong> et les paramètres d&apos;envoi sont bien renseignés.</p>
            </HelpStep>
            <HelpStep number={3} title="Demandez au locataire de vérifier ses spams">
              <p>Les emails de gestion locative sont parfois filtrés. Demandez au locataire d&apos;ajouter votre adresse expéditrice à ses contacts.</p>
            </HelpStep>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Je ne reçois pas les notifications de l&apos;application</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Allez dans <strong>Paramètres &gt; Notifications</strong> et vérifiez que les notifications par email sont activées.</li>
              <li>Vérifiez votre dossier spam.</li>
              <li>Assurez-vous que votre adresse email dans le profil utilisateur est correcte.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="factures" title="Problèmes de facturation">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Les factures ne sont pas générées automatiquement</p>
            <p className="text-sm mb-2">La génération automatique des brouillons s&apos;exécute chaque jour à 7h du matin. Vérifiez les points suivants :</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Le bail est-il bien en statut <strong>Actif</strong> ? Un bail expiré ou résilié ne génère plus de factures.</li>
              <li>La date de début du bail est-elle passée ?</li>
              <li>La période de facturation est-elle configurée (mensuelle, trimestrielle, etc.) ?</li>
              <li>Y a-t-il déjà une facture en brouillon ou envoyée pour cette période ? L&apos;application ne génère pas de doublon.</li>
            </ul>
            <InfoBox type="tip">
              Vous pouvez générer manuellement une facture depuis la page du bail en cliquant sur <strong>Générer une facture</strong>.
            </InfoBox>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Le montant de la facture est incorrect</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez le loyer et les charges configurés dans le bail (<strong>Baux &gt; [nom du bail] &gt; Modifier</strong>).</li>
              <li>Si une révision de loyer a été appliquée, vérifiez l&apos;historique des révisions dans <strong>Baux &gt; Révisions</strong>.</li>
              <li>Si la facture est encore en brouillon, vous pouvez la modifier directement.</li>
              <li>Si la facture est déjà envoyée, créez un avoir pour annuler et réémettre.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Le PDF de la facture ne s&apos;affiche pas ou ne se télécharge pas</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez que le logo de votre société est au format PNG ou JPG et fait moins de 2 Mo.</li>
              <li>Assurez-vous que les informations de la société (SIRET, adresse, email) sont complètes dans les paramètres.</li>
              <li>Essayez depuis un autre navigateur ou en désactivant votre bloqueur de publicités.</li>
              <li>Si le problème persiste, contactez le support en mentionnant le numéro de facture.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Un paiement a été enregistré mais la facture reste &laquo; Impayée &raquo;</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez que le paiement est bien associé à la facture (fiche facture &gt; onglet Paiements).</li>
              <li>Le montant du paiement correspond-il exactement au montant de la facture ? Un paiement partiel ne solde pas la facture.</li>
              <li>Rechargez la page — le statut peut mettre quelques secondes à se mettre à jour.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="banque" title="Problèmes de banque et rapprochement">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">La synchronisation bancaire ne ramène pas de nouvelles transactions</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>La synchronisation automatique s&apos;exécute chaque jour à 6h. En dehors de ce créneau, lancez une synchronisation manuelle depuis la fiche du compte.</li>
              <li>Vérifiez que la connexion Open Banking est toujours active (statut &laquo; Connecté &raquo; dans <strong>Banque &gt; Connexions</strong>).</li>
              <li>Certaines banques nécessitent une ré-authentification tous les 90 jours (SCA/DSP2). Si la connexion est expirée, reconnectez-la.</li>
              <li>Les transactions apparaissent généralement dans un délai de 1 à 2 jours ouvrés selon la banque.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Le rapprochement automatique ne trouve pas de correspondance</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Le rapprochement automatique se base sur le <strong>montant exact</strong> et une <strong>date proche</strong>. Si le montant diffère (paiement partiel, frais bancaires déduits), il ne match pas.</li>
              <li>Vérifiez que la facture est bien en statut &laquo; Envoyée &raquo; ou &laquo; En retard &raquo; (les brouillons ne sont pas proposés au rapprochement).</li>
              <li>Rapprochez manuellement en sélectionnant la transaction et la facture.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">L&apos;export FEC est vide ou incomplet</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez que des écritures comptables existent pour la période sélectionnée (menu <strong>Comptabilité</strong>).</li>
              <li>Seules les écritures <strong>validées</strong> sont incluses dans le FEC (pas les brouillons).</li>
              <li>Vérifiez que le plan comptable est configuré avec des numéros de comptes valides.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="portail" title="Problèmes du portail locataire">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Mon locataire ne peut pas accéder au portail</p>
            <HelpStep number={1} title="Vérifiez que le portail est activé">
              <p>Dans la fiche locataire, vérifiez que l&apos;accès portail est activé. Le locataire doit avoir une adresse email valide dans sa fiche.</p>
            </HelpStep>
            <HelpStep number={2} title="Renvoyez l'invitation">
              <p>Depuis la fiche locataire, cliquez sur <strong>Envoyer l&apos;invitation portail</strong>. Le locataire reçoit un email avec un lien d&apos;accès.</p>
            </HelpStep>
            <HelpStep number={3} title="Vérifiez l'URL du portail">
              <p>L&apos;URL du portail est différente de l&apos;URL principale de l&apos;application. Communiquez la bonne adresse à votre locataire.</p>
            </HelpStep>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Le locataire ne voit pas ses factures sur le portail</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Seules les factures avec le statut <strong>Envoyée</strong>, <strong>En retard</strong> ou <strong>Payée</strong> sont visibles sur le portail. Les brouillons sont masqués.</li>
              <li>Vérifiez que la facture est bien associée au bon bail et au bon locataire.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="ia" title="Problèmes liés à l'intelligence artificielle">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">L&apos;analyse de document par IA échoue ou reste en &laquo; En cours &raquo;</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>L&apos;analyse peut prendre jusqu&apos;à 2 minutes pour les documents volumineux. Attendez avant de réessayer.</li>
              <li>Les formats supportés sont : PDF, JPG, PNG. Les fichiers Excel ou Word ne sont pas analysés par l&apos;IA.</li>
              <li>La taille maximale d&apos;un document est de 20 Mo.</li>
              <li>Si l&apos;analyse reste bloquée plus de 5 minutes, le système réessaiera automatiquement la nuit (cron horaire de reprise).</li>
              <li>Vous pouvez forcer une nouvelle analyse en supprimant le document et en le ré-uploadant.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">L&apos;assistant IA ne répond plus ou renvoie une erreur</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Rechargez la page et réessayez.</li>
              <li>L&apos;assistant IA nécessite une connexion internet stable.</li>
              <li>En cas d&apos;interruption du service IA, une bannière s&apos;affiche dans l&apos;application. Consultez la page statut si elle est disponible.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">L&apos;évaluation patrimoniale renvoie des résultats incohérents</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez que la fiche du lot contient des informations complètes : surface, type de bien, adresse précise, état général.</li>
              <li>L&apos;évaluation est basée sur des données de marché (DVF) et peut manquer de précision dans les zones rurales peu actives.</li>
              <li>Le score de confiance indiqué dans le résultat vous donne une indication de la fiabilité de l&apos;estimation.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="indices" title="Problèmes d'indices INSEE">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">L&apos;indice du dernier trimestre n&apos;est pas disponible</p>
            <p className="text-sm mb-2">
              L&apos;INSEE publie les indices IRL, ILC, ILAT et ICC avec un délai d&apos;environ 45 à 60 jours après la fin du trimestre. L&apos;application synchronise automatiquement les indices le 1er de chaque mois.
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Si l&apos;indice attendu n&apos;est pas encore publié par l&apos;INSEE, il n&apos;est pas disponible dans l&apos;application — c&apos;est normal.</li>
              <li>Consultez directement le site de l&apos;INSEE pour vérifier si l&apos;indice a été publié.</li>
              <li>Vous pouvez saisir manuellement une valeur d&apos;indice dans <strong>Indices &gt; Ajouter un indice</strong> en attendant la synchronisation automatique.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="performance" title="Lenteurs et problèmes d'affichage">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">L&apos;application est lente ou ne répond pas</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez votre connexion internet.</li>
              <li>Videz le cache de votre navigateur (<strong>Ctrl + Maj + Suppr</strong> sur Windows, <strong>Cmd + Maj + Suppr</strong> sur Mac).</li>
              <li>Essayez un autre navigateur (Chrome, Firefox, Edge).</li>
              <li>Si vous avez un grand nombre de lots ou de factures, certaines pages peuvent prendre quelques secondes à charger — c&apos;est normal.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Une page affiche une erreur blanche ou un message d&apos;erreur</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Rechargez la page avec <strong>F5</strong> ou <strong>Ctrl + R</strong>.</li>
              <li>Si l&apos;erreur persiste, notez l&apos;URL de la page et le message d&apos;erreur, puis contactez le support.</li>
              <li>Essayez de naviguer vers la page depuis le menu principal plutôt que depuis un lien direct ou les favoris.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Les graphiques du tableau de bord ne s&apos;affichent pas</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Les graphiques nécessitent des données existantes (baux, factures) pour s&apos;afficher. Si vous venez de créer votre compte, le tableau de bord sera vide.</li>
              <li>Désactivez les extensions de navigateur (bloqueurs de publicités, etc.) qui peuvent bloquer le rendu des graphiques.</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="donnees" title="Problèmes de données et d'imports">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">L&apos;import de données échoue</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez que le fichier est au format CSV ou Excel (.xlsx) et qu&apos;il correspond au modèle fourni (téléchargeable depuis la page d&apos;import).</li>
              <li>Les en-têtes de colonnes doivent correspondre exactement au modèle.</li>
              <li>Vérifiez qu&apos;il n&apos;y a pas de lignes vides dans le fichier.</li>
              <li>La taille maximale du fichier d&apos;import est de 20 Mo.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">J&apos;ai supprimé des données par erreur</p>
            <p className="text-sm mb-2">
              Les locataires, baux et documents sont conservés en base de données même après suppression (suppression logique). Contactez le support <strong>rapidement</strong> pour une restauration.
            </p>
            <InfoBox type="warning">
              Les données supprimées peuvent être restaurées dans un délai de 30 jours. Au-delà, la restauration n&apos;est plus garantie.
            </InfoBox>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="abonnement" title="Problèmes d'abonnement et de limites">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Je ne peux plus ajouter de lots ou d&apos;utilisateurs</p>
            <p className="text-sm mb-2">Votre plan actuel a des limites :</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li><strong>STARTER</strong> : 20 lots, 2 utilisateurs, 1 société</li>
              <li><strong>PRO</strong> : 50 lots, 5 utilisateurs, 3 sociétés</li>
              <li><strong>ENTERPRISE</strong> : illimité</li>
            </ul>
            <p className="text-sm mt-2">Pour augmenter ces limites, allez dans <strong>Compte &gt; Abonnement &gt; Changer de plan</strong>.</p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Ma période d&apos;essai a expiré mais je veux continuer</p>
            <p className="text-sm">
              La période d&apos;essai dure 14 jours. À son expiration, l&apos;accès aux fonctions d&apos;écriture est restreint. Allez dans <strong>Compte &gt; Abonnement</strong> pour souscrire à un plan payant et retrouver l&apos;accès complet.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Mon paiement Stripe a échoué</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Vérifiez que les informations de votre carte sont à jour dans <strong>Compte &gt; Abonnement &gt; Gérer le paiement</strong>.</li>
              <li>Votre banque peut bloquer les paiements en ligne — contactez-la pour autoriser la transaction.</li>
              <li>En cas d&apos;échec persistant, contactez le support avec votre identifiant de société.</li>
            </ul>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
