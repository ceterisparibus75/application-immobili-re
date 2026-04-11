import { TrendingUp } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Évaluations IA et emprunts | Centre d'aide | ${APP_NAME}`,
};

export default function EmpruntsPage() {
  return (
    <HelpPageLayout
      slug="emprunts"
      icon={<TrendingUp className="h-6 w-6" />}
      title="Évaluations IA et emprunts"
      description="Estimez la valeur de votre patrimoine par intelligence artificielle et gérez vos emprunts bancaires avec tableaux d'amortissement."
    >
      <HelpSection id="evaluation-ia" title="Évaluation IA du patrimoine">
        <p>
          {APP_NAME} intègre un système d'évaluation automatique de la valeur de vos immeubles, basé sur l'intelligence artificielle et les données du marché immobilier.
        </p>
        <HelpStep number={1} title="Lancez une évaluation">
          <p>Depuis la fiche d'un immeuble, section <strong>Valorisation</strong>, cliquez sur le bouton <strong>Évaluation IA</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="L'IA analyse votre bien">
          <p>L'algorithme prend en compte l'adresse, la surface, le type de bien, l'année de construction, le taux d'occupation, les loyers perçus et les données de marché locales pour calculer une estimation.</p>
        </HelpStep>
        <HelpStep number={3} title="Consultez le rapport">
          <p>Un rapport détaillé est généré avec la valeur estimée, la méthode de calcul, les comparables utilisés et un indice de confiance. Vous pouvez l'enregistrer comme valeur de référence de l'immeuble.</p>
        </HelpStep>
        <InfoBox type="info">
          L'évaluation IA est une estimation indicative. Elle ne remplace pas une expertise immobilière professionnelle mais constitue un excellent outil de pilotage.
        </InfoBox>
      </HelpSection>

      <HelpSection id="vue-emprunts" title="Vue d'ensemble des emprunts">
        <p>
          La page <strong>Emprunts</strong> affiche 4 indicateurs clés :
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Capital emprunté", desc: "Montant total initial de tous vos prêts" },
            { title: "Capital restant dû", desc: "Montant qu'il vous reste à rembourser (affiché en rouge)" },
            { title: "Capital remboursé", desc: "Montant déjà remboursé (affiché en vert)" },
            { title: "Mensualité totale", desc: "Somme de toutes vos mensualités en cours (affiché en bleu)" },
          ].map((kpi) => (
            <div key={kpi.title} className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">{kpi.title}</p>
              <p className="text-xs text-muted-foreground">{kpi.desc}</p>
            </div>
          ))}
        </div>
        <p>
          Les emprunts sont regroupés par <strong>prêteur</strong> (banque ou organisme). Pour chaque prêteur, vous voyez le total du capital restant dû, la mensualité globale et le nombre de prêts. Une barre de progression indique visuellement le taux de remboursement.
        </p>
      </HelpSection>

      <HelpSection id="types-emprunts" title="Les 3 types d'emprunts">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Emprunt amortissable</p>
            <p>Le type le plus courant. Chaque mensualité rembourse une partie du capital et une partie des intérêts. Le montant du capital remboursé augmente progressivement tandis que les intérêts diminuent.</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Exemple : prêt de 200 000 &euro; sur 20 ans à 2% &rarr; mensualité fixe d'environ 1 012 &euro;</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Emprunt in fine</p>
            <p>Seuls les intérêts sont payés chaque mois. Le capital est remboursé en totalité à l'échéance du prêt. Utilisé pour optimiser la fiscalité (intérêts déductibles) ou en attente de revente.</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Exemple : prêt de 200 000 &euro; sur 10 ans à 2.5% &rarr; mensualité de 417 &euro; (intérêts uniquement) + remboursement de 200 000 &euro; à la fin</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Emprunt bullet (ballon)</p>
            <p>Aucun paiement intermédiaire : ni intérêts, ni capital. La totalité (capital + intérêts) est remboursée en un seul versement à l'échéance. Rare, utilisé pour des financements relais de courte durée.</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="creer-emprunt" title="Créer un emprunt">
        <HelpStep number={1} title="Cliquez sur Nouvel emprunt">
          <p>Depuis la page Emprunts, cliquez sur le bouton <strong>Nouvel emprunt</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Renseignez les caractéristiques">
          <p>Libellé du prêt, type (amortissable, in fine, bullet), montant emprunté, taux d'intérêt annuel, durée en mois, date de début, nom du prêteur.</p>
        </HelpStep>
        <HelpStep number={3} title="Associez à un immeuble (optionnel)">
          <p>Liez l'emprunt à un immeuble pour calculer automatiquement le ratio LTV (Loan-to-Value) et suivre l'endettement par bien.</p>
        </HelpStep>
        <HelpStep number={4} title="Consultez le tableau d'amortissement">
          <p>Une fois créé, {APP_NAME} génère automatiquement le tableau d'amortissement complet : pour chaque échéance, vous voyez le capital remboursé, les intérêts, l'assurance et le capital restant dû.</p>
        </HelpStep>
      </HelpSection>

      <HelpSection id="amortissement" title="Tableau d'amortissement">
        <p>
          Le tableau d'amortissement détaille chaque échéance de votre emprunt :
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-semibold">Échéance</th>
                <th className="text-right px-3 py-2 font-semibold">Capital</th>
                <th className="text-right px-3 py-2 font-semibold">Intérêts</th>
                <th className="text-right px-3 py-2 font-semibold">Mensualité</th>
                <th className="text-right px-3 py-2 font-semibold">Restant dû</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              <tr>
                <td className="px-3 py-2">01/2025</td>
                <td className="px-3 py-2 text-right">678,45 &euro;</td>
                <td className="px-3 py-2 text-right">333,33 &euro;</td>
                <td className="px-3 py-2 text-right font-medium">1 011,78 &euro;</td>
                <td className="px-3 py-2 text-right">199 321,55 &euro;</td>
              </tr>
              <tr>
                <td className="px-3 py-2">02/2025</td>
                <td className="px-3 py-2 text-right">679,58 &euro;</td>
                <td className="px-3 py-2 text-right">332,20 &euro;</td>
                <td className="px-3 py-2 text-right font-medium">1 011,78 &euro;</td>
                <td className="px-3 py-2 text-right">198 641,97 &euro;</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-muted-foreground" colSpan={5}>...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </HelpSection>

      <HelpSection id="ltv" title="Ratio LTV (Loan-to-Value)">
        <p>
          Le ratio LTV mesure l'endettement par rapport à la valeur du patrimoine. Il est calculé automatiquement par {APP_NAME} :
        </p>
        <div className="rounded-lg border p-4 bg-muted/20 font-mono text-sm text-center">
          LTV = Capital restant dû / Valeur du patrimoine &times; 100
        </div>
        <ul className="list-disc pl-5 space-y-1 mt-3">
          <li><strong className="text-emerald-600">LTV &lt; 50%</strong> : endettement sain</li>
          <li><strong className="text-amber-600">LTV 50-80%</strong> : endettement modéré, à surveiller</li>
          <li><strong className="text-red-600">LTV &gt; 80%</strong> : endettement élevé, attention</li>
        </ul>
        <p>
          Le LTV est visible sur le tableau de bord principal et sur la vue Propriétaire.
        </p>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur les emprunts et évaluations">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Quelle est la différence entre un emprunt amortissable et in fine ?</p>
            <p>Amortissable : remboursement progressif du capital + intérêts à chaque échéance. In fine : seuls les intérêts sont payés chaque mois, le capital est remboursé en totalité à l'échéance du prêt.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment modifier un emprunt existant ?</p>
            <p>Depuis la fiche de l'emprunt, cliquez sur le bouton Modifier. Vous pouvez ajuster le taux, la durée ou le montant de l'assurance.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment suivre le remboursement de mes emprunts ?</p>
            <p>Le tableau d'amortissement montre chaque échéance avec le détail capital, intérêts et restant dû. Les échéances payées sont cochées automatiquement lors du rapprochement bancaire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Qu'est-ce que le ratio LTV ?</p>
            <p>Loan-to-Value = Capital restant dû / Valeur du patrimoine &times; 100. C'est un indicateur d'endettement visible sur le tableau de bord et la vue Propriétaire.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">L'évaluation IA est-elle fiable ?</p>
            <p>C'est une estimation indicative basée sur les données de marché (comparables, DVF, loyers). Elle ne remplace pas une expertise immobilière professionnelle mais donne une bonne tendance pour piloter votre patrimoine.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment associer un emprunt à un immeuble ?</p>
            <p>Lors de la création ou modification de l'emprunt, sélectionnez l'immeuble concerné dans le champ dédié. Le ratio LTV sera alors calculé automatiquement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je ajouter une assurance emprunteur ?</p>
            <p>Oui, renseignez le montant mensuel d'assurance lors de la création de l'emprunt. Il sera inclus dans les échéances du tableau d'amortissement.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment exporter le tableau d'amortissement ?</p>
            <p>Depuis la fiche de l'emprunt, utilisez le bouton d'export pour télécharger le tableau au format CSV ou PDF.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
