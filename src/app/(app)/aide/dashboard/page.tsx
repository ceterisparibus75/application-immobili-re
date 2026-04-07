import { BarChart3 } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Tableau de bord et rapports | Centre d'aide | ${APP_NAME}`,
};

export default function DashboardPage() {
  return (
    <HelpPageLayout
      slug="dashboard"
      icon={<BarChart3 className="h-6 w-6" />}
      title="Tableau de bord et rapports"
      description="Visualisez vos indicateurs clés en temps réel, analysez les tendances et générez des rapports détaillés."
    >
      <HelpSection id="kpi" title="Indicateurs clés (KPI)">
        <p>
          Le tableau de bord affiche 4 indicateurs principaux en haut de page, mis à jour en temps réel :
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Revenus du mois</p>
            <p>Montant total des loyers perçus sur le mois en cours, avec la variation en pourcentage par rapport au mois précédent (flèche verte en hausse, rouge en baisse).</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Taux d&apos;occupation</p>
            <p>Pourcentage de lots occupés sur le total de lots, avec une barre de progression visuelle. Indicateur clé de la performance locative.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Impayés</p>
            <p>Montant total des factures en retard de paiement. Affiché en rouge si supérieur à 0, avec le nombre de factures concernées.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Trésorerie / Rendement</p>
            <p>Selon le contexte : solde de trésorerie disponible ou rendement brut annualisé. Une alerte apparaît si des baux expirent prochainement.</p>
          </div>
        </div>
        <ScreenshotPlaceholder alt="KPI du tableau de bord" caption="Les 4 indicateurs principaux en haut du tableau de bord" />
      </HelpSection>

      <HelpSection id="endettement" title="Synthèse de l'endettement">
        <p>
          Si vous avez des emprunts en cours, une carte <strong>Endettement</strong> apparaît sous les KPI. Elle affiche le capital restant dû, la mensualité totale et le ratio LTV (Loan-to-Value).
        </p>
        <p>
          Un tableau récapitulatif par prêteur montre : le nom de la banque, le nombre de prêts, le capital restant dû, la mensualité et une barre de progression du remboursement.
        </p>
        <ScreenshotPlaceholder alt="Carte endettement" caption="Synthèse de l'endettement avec prêteurs, mensualités et progression" />
      </HelpSection>

      <HelpSection id="graphiques" title="Graphiques interactifs">
        <p>
          Le tableau de bord propose 6 graphiques interactifs qui se mettent à jour automatiquement :
        </p>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Revenus mensuels</p>
            <p>Courbe d&apos;évolution des revenus sur les 12 derniers mois. Permet d&apos;identifier les tendances et les saisonnalités.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Occupation par immeuble</p>
            <p>Graphique en barres montrant le nombre de lots occupés vs vacants par immeuble. Identifiez rapidement les biens sous-performants.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Impayés par ancienneté</p>
            <p>Répartition des impayés par tranche d&apos;âge : 0-30 jours, 30-60 jours, plus de 60 jours. Plus l&apos;impayé est ancien, plus il est difficile à recouvrer.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Évolution du patrimoine</p>
            <p>Courbe montrant l&apos;évolution de la valeur totale de votre patrimoine immobilier dans le temps.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Concentration des risques</p>
            <p>Diagramme montrant le poids de chaque locataire dans vos revenus. Un locataire représentant plus de 30% des revenus constitue un risque de concentration.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Timeline des baux</p>
            <p>Vue chronologique des échéances de baux. Les baux expirant dans les 3 mois sont signalés en rouge, dans les 6 mois en orange.</p>
          </div>
        </div>
        <ScreenshotPlaceholder alt="Graphiques du tableau de bord" caption="Vue des 6 graphiques interactifs (revenus, occupation, impayés, patrimoine, risques, baux)" />
      </HelpSection>

      <HelpSection id="monitoring" title="Panneau de monitoring détaillé">
        <p>
          À droite du tableau de bord, un panneau de monitoring regroupe des indicateurs détaillés par catégorie :
        </p>
        <div className="space-y-3">
          {[
            { title: "Patrimoine", items: "Nombre d'immeubles, de lots, taux d'occupation, valeur estimée, rendement brut" },
            { title: "Locataires et baux", items: "Locataires actifs, baux en cours, baux expirant bientôt" },
            { title: "Facturation", items: "Loyer mensuel HT, factures impayées, montant des impayés, charges récupérables" },
            { title: "Trésorerie", items: "Solde disponible sur tous les comptes (vert si positif, rouge si négatif)" },
            { title: "Technique", items: "Diagnostics expirant, maintenances ouvertes" },
            { title: "Endettement", items: "Capital restant dû, mensualité totale, nombre de prêts, ratio LTV" },
          ].map((cat) => (
            <div key={cat.title} className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">{cat.title}</p>
              <p className="text-xs text-muted-foreground">{cat.items}</p>
            </div>
          ))}
        </div>
        <ScreenshotPlaceholder alt="Panneau de monitoring" caption="Indicateurs détaillés par catégorie dans le panneau latéral" />
      </HelpSection>

      <HelpSection id="taches" title="Tâches du jour">
        <p>
          La section <strong>Tâches du jour</strong> affiche les actions urgentes nécessitant votre attention : factures à valider, relances à envoyer, diagnostics expirant, baux à renouveler, etc.
        </p>
        <p>
          Chaque tâche est cliquable et vous redirige vers l&apos;écran correspondant pour agir immédiatement.
        </p>
        <ScreenshotPlaceholder alt="Tâches du jour" caption="Liste des actions urgentes avec liens directs vers les écrans concernés" />
      </HelpSection>

      <HelpSection id="rapports" title="Rapports et exports">
        <p>
          Depuis le module <strong>Rapports</strong>, vous pouvez générer des rapports détaillés sur différents aspects de votre gestion :
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Rapport de revenus</strong> : détail des loyers perçus par mois, par immeuble ou par locataire</li>
          <li><strong>Rapport d&apos;occupation</strong> : taux d&apos;occupation mensuel avec historique</li>
          <li><strong>Rapport d&apos;impayés</strong> : analyse détaillée des retards de paiement</li>
          <li><strong>Rapport de trésorerie</strong> : flux de trésorerie entrants et sortants</li>
          <li><strong>Export FEC</strong> : fichier des écritures comptables au format réglementaire</li>
          <li><strong>Rapport de valorisation</strong> : évolution de la valeur du patrimoine</li>
        </ul>
        <p>
          Les rapports sont exportables en <strong>PDF</strong> ou <strong>Excel</strong>. Vous pouvez aussi planifier l&apos;envoi automatique de rapports par email.
        </p>
        <ScreenshotPlaceholder alt="Module rapports" caption="Interface de génération de rapports avec sélection de type et période" />
        <InfoBox type="tip">
          Le champ email du profil propriétaire permet de recevoir automatiquement les rapports programmés. Configurez-le dans la vue Propriétaire &gt; Profil.
        </InfoBox>
      </HelpSection>
    </HelpPageLayout>
  );
}
