import { Zap } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Automatisation et IA | Centre d'aide | ${APP_NAME}`,
};

export default function AutomatisationPage() {
  return (
    <HelpPageLayout
      slug="automatisation"
      icon={<Zap className="h-6 w-6" />}
      title="Automatisation et IA"
      description="Workflows automatisés, assistant IA conversationnel, prédiction d'impayés, import intelligent et tickets de maintenance."
    >
      <HelpSection id="workflows" title="Workflows automatisés">
        <p>
          Le module <strong>Workflows</strong> vous permet de créer des automatisations sur mesure pour votre gestion locative. Chaque workflow se compose d'un <strong>déclencheur</strong> et d'une série d'<strong>étapes</strong>.
        </p>
        <p className="font-semibold text-foreground mt-4 mb-2">Types de déclencheurs :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Événement</strong> : se déclenche quand quelque chose se produit (facture en retard, bail expirant, nouveau locataire...)</li>
          <li><strong>Planifié</strong> : s'exécute selon un calendrier (tous les lundis, le 1er du mois, chaque trimestre...)</li>
          <li><strong>Manuel</strong> : vous le déclenchez vous-même quand vous le souhaitez</li>
        </ul>
        <p className="font-semibold text-foreground mt-4 mb-2">Étapes disponibles :</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { name: "Envoyer un email", desc: "Email personnalisé au locataire ou au gestionnaire" },
            { name: "Notification", desc: "Notification dans l'application" },
            { name: "Générer un PDF", desc: "Facture, quittance ou rapport" },
            { name: "Délai", desc: "Attendre X jours avant l'étape suivante" },
            { name: "Relance", desc: "Envoyer une relance de niveau 1, 2 ou 3" },
            { name: "Changement de statut", desc: "Modifier le statut d'une facture, d'un bail..." },
            { name: "Créer une tâche", desc: "Ajouter une tâche de suivi" },
            { name: "Condition", desc: "Si/sinon pour brancher le workflow" },
            { name: "Webhook", desc: "Appeler une URL externe (API tierce)" },
          ].map((s) => (
            <div key={s.name} className="rounded-lg border p-2.5">
              <p className="text-xs font-semibold text-foreground">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4 bg-muted/20 mt-4">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret — Workflow de relance intelligente :</p>
          <p className="text-sm">
            Déclencheur : &laquo; Facture passe en retard &raquo;<br />
            &rarr; Étape 1 : Attendre 3 jours<br />
            &rarr; Étape 2 : Envoyer email de relance courtoise (niveau 1)<br />
            &rarr; Étape 3 : Attendre 14 jours<br />
            &rarr; Étape 4 : Condition — si toujours impayée :<br />
            &nbsp;&nbsp;&rarr; Oui : Envoyer relance ferme (niveau 2) + Notification au gestionnaire<br />
            &nbsp;&nbsp;&rarr; Non : Fin du workflow<br />
            &rarr; Étape 5 : Attendre 21 jours<br />
            &rarr; Étape 6 : Envoyer mise en demeure (niveau 3)
          </p>
        </div>
        <InfoBox type="info">
          Chaque workflow affiche son historique d'exécution : les 3 dernières exécutions avec leur statut (succès/échec/en cours). Vous pouvez activer ou désactiver un workflow à tout moment.
        </InfoBox>
      </HelpSection>

      <HelpSection id="assistant-ia" title="Assistant IA conversationnel">
        <p>
          L'<strong>Assistant IA</strong> (plan Enterprise) est un chatbot intelligent qui connaît votre patrimoine et peut répondre à vos questions en langage naturel.
        </p>
        <p className="font-semibold text-foreground mt-4 mb-2">3 onglets disponibles :</p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Chatbot</p>
            <p>Posez des questions en français sur votre gestion : &laquo; Quels locataires ont des impayés de plus de 30 jours ? &raquo;, &laquo; Quel est mon taux d'occupation sur la SCI Soleil ? &raquo;, &laquo; Résume l'activité du mois dernier &raquo;. L'IA interroge vos données en temps réel et répond de manière contextuelle.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Générateur de courriers</p>
            <p>Décrivez le courrier souhaité et l'IA le rédige : sujet, corps avec mise en forme, références légales, ton adapté (courtois, formel, juridique) et résumé. Exemple : &laquo; Rédige une lettre de congé pour vente au locataire de l'Apt 2B &raquo;.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Prédiction d'impayés</p>
            <p>L'IA analyse l'historique de paiement de chaque locataire sur les 12 derniers mois et calcule : un score de risque, le niveau de risque (faible/moyen/élevé/critique), la probabilité de défaut, le nombre de jours de retard prévisible et des recommandations d'action.</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 bg-muted/20 mt-4">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret — Prédiction d'impayés :</p>
          <p className="text-sm">
            L'IA analyse Jean Dupont : 3 retards de paiement sur 12 mois (5, 12 et 8 jours), montants moyens de 1 030 &euro;. Résultat : Score de risque 65/100, Niveau &laquo; Moyen &raquo;, Probabilité de défaut 35%, Retard prévisible 7 jours. Recommandation : &laquo; Mettre en place un prélèvement automatique SEPA pour sécuriser les paiements &raquo;.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="tickets" title="Tickets de maintenance">
        <p>
          Le module <strong>Tickets</strong> centralise toutes les demandes d'intervention technique, qu'elles viennent de vous, de vos gestionnaires ou directement des locataires via le portail.
        </p>
        <p className="font-semibold text-foreground mt-4 mb-2">Statuts d'un ticket :</p>
        <div className="space-y-2">
          {[
            { status: "Ouvert", color: "bg-blue-100 text-blue-700", desc: "Demande reçue, en attente de prise en charge" },
            { status: "En cours", color: "bg-amber-100 text-amber-700", desc: "Intervention assignée et en cours de traitement" },
            { status: "En attente", color: "bg-gray-100 text-gray-700", desc: "En attente d'une information ou d'un prestataire" },
            { status: "Résolu", color: "bg-emerald-100 text-emerald-700", desc: "Intervention terminée avec succès" },
            { status: "Fermé", color: "bg-slate-100 text-slate-700", desc: "Ticket clôturé définitivement" },
          ].map((s) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${s.color}`}>{s.status}</span>
              <span className="text-sm">{s.desc}</span>
            </div>
          ))}
        </div>
        <p className="font-semibold text-foreground mt-4 mb-2">Priorités :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-gray-600">Basse</strong> : demande non urgente (peinture, petit aménagement)</li>
          <li><strong className="text-blue-600">Normale</strong> : intervention standard (robinet qui goutte, volet coincé)</li>
          <li><strong className="text-amber-600">Haute</strong> : problème impactant le confort (chauffage en panne, fuite modérée)</li>
          <li><strong className="text-red-600">Urgente</strong> : danger ou dégât immédiat (fuite d'eau importante, panne électrique, effraction)</li>
        </ul>
        <p className="font-semibold text-foreground mt-4 mb-2">Catégories :</p>
        <p>Maintenance générale, Plomberie, Électricité, Chauffage, Nuisances, Parties communes, Document, Facturation, Assurance, Autre.</p>
        <div className="rounded-lg border p-4 bg-muted/20 mt-4">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Un locataire signale une fuite sous l'évier via le portail locataire. Le ticket est créé automatiquement : catégorie &laquo; Plomberie &raquo;, priorité &laquo; Haute &raquo;, statut &laquo; Ouvert &raquo;. Vous assignez le plombier M. Martin et passez le statut à &laquo; En cours &raquo;. Après l'intervention, vous passez à &laquo; Résolu &raquo; et le locataire est notifié.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="import-ia" title="Import intelligent (IA)">
        <p>
          Le module <strong>Import</strong> (plan Enterprise pour l'IA) permet d'importer vos données depuis des fichiers CSV, Excel ou directement depuis des PDF de baux.
        </p>
        <p>
          L'import IA analyse le contenu d'un PDF de bail et extrait automatiquement : le nom du locataire, l'adresse du lot, le montant du loyer, les dates de début et de fin, le type de bail et les charges. Vous vérifiez les données extraites, corrigez si nécessaire, puis validez — l'immeuble, le lot, le locataire et le bail sont créés en une seule opération.
        </p>
        <InfoBox type="tip">
          L'import classique (CSV/Excel) est disponible sur tous les plans. L'import IA depuis PDF est réservé au plan Enterprise.
        </InfoBox>
      </HelpSection>

      <HelpSection id="indices" title="Indices INSEE">
        <p>
          Le module <strong>Indices</strong> suit les 4 indices de référence pour les révisions de loyer :
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2.5 font-semibold">Indice</th>
                <th className="text-left px-4 py-2.5 font-semibold">Usage</th>
                <th className="text-left px-4 py-2.5 font-semibold">Délai de publication</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="px-4 py-2 font-medium">IRL</td><td className="px-4 py-2">Baux d'habitation</td><td className="px-4 py-2">~45 jours après le trimestre</td></tr>
              <tr><td className="px-4 py-2 font-medium">ILC</td><td className="px-4 py-2">Baux commerciaux</td><td className="px-4 py-2">~90 jours après le trimestre</td></tr>
              <tr><td className="px-4 py-2 font-medium">ILAT</td><td className="px-4 py-2">Baux tertiaires (bureaux)</td><td className="px-4 py-2">~90 jours après le trimestre</td></tr>
              <tr><td className="px-4 py-2 font-medium">ICC</td><td className="px-4 py-2">Indice du coût de la construction</td><td className="px-4 py-2">~90 jours après le trimestre</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Les indices sont synchronisés automatiquement le 1er de chaque mois via l'API INSEE. Quand un nouvel indice est publié, {APP_NAME} calcule automatiquement les révisions de loyer dues et les affiche dans le module Révisions.
        </p>
        <div className="rounded-lg border p-4 bg-muted/20 mt-4">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret — Révision de loyer :</p>
          <p className="text-sm">
            Bail indexé IRL T1, loyer de base 950 &euro;. IRL T1 2025 = 143,46, IRL T1 2026 = 145,81. Nouveau loyer = 950 &times; (145,81 / 143,46) = 965,56 &euro;. L'application propose cette révision, vous la validez en un clic et le nouveau loyer est appliqué automatiquement sur les prochaines factures.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Les workflows sont-ils disponibles sur tous les plans ?</p>
            <p>Les workflows de base sont disponibles dès le plan Pro. Les workflows avancés avec conditions et webhooks sont réservés au plan Enterprise.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">L'assistant IA peut-il accéder à toutes mes données ?</p>
            <p>L'assistant IA accède uniquement aux données de la société active. Il respecte les mêmes règles de permissions que votre rôle utilisateur. Il ne peut pas modifier de données, seulement les consulter et vous répondre.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Les locataires peuvent-ils créer des tickets depuis leur portail ?</p>
            <p>Oui, le portail locataire inclut un bouton &laquo; Signaler un problème &raquo; qui crée automatiquement un ticket avec la catégorie et la description saisies par le locataire. Le gestionnaire reçoit une notification.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment rattraper des révisions de loyer oubliées ?</p>
            <p>Allez dans <strong>Indices</strong> et utilisez le bouton <strong>Rattraper</strong>. L'application recalcule année par année les révisions manquées et vous propose de les appliquer rétroactivement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">La prédiction IA est-elle fiable ?</p>
            <p>La prédiction est basée sur l'historique réel des 12 derniers mois de paiement du locataire. C'est un indicateur de tendance utile pour anticiper les risques, mais pas une certitude. Utilisez-la comme aide à la décision, pas comme verdict définitif.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
