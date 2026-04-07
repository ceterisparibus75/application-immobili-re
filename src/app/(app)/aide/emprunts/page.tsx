import { TrendingUp } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

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
          {APP_NAME} intègre un système d&apos;évaluation automatique de la valeur de vos immeubles, basé sur l&apos;intelligence artificielle et les données du marché immobilier.
        </p>
        <HelpStep number={1} title="Lancez une évaluation">
          <p>Depuis la fiche d&apos;un immeuble, section <strong>Valorisation</strong>, cliquez sur le bouton <strong>Évaluation IA</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="L'IA analyse votre bien">
          <p>L&apos;algorithme prend en compte l&apos;adresse, la surface, le type de bien, l&apos;année de construction, le taux d&apos;occupation, les loyers perçus et les données de marché locales pour calculer une estimation.</p>
        </HelpStep>
        <HelpStep number={3} title="Consultez le rapport">
          <p>Un rapport détaillé est généré avec la valeur estimée, la méthode de calcul, les comparables utilisés et un indice de confiance. Vous pouvez l&apos;enregistrer comme valeur de référence de l&apos;immeuble.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Rapport d'évaluation IA" caption="Rapport avec valeur estimée, méthode, comparables et indice de confiance" />
        <InfoBox type="info">
          L&apos;évaluation IA est une estimation indicative. Elle ne remplace pas une expertise immobilière professionnelle mais constitue un excellent outil de pilotage.
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
        <ScreenshotPlaceholder alt="Page emprunts" caption="KPI d'endettement et liste des emprunts groupés par prêteur" />
        <p>
          Les emprunts sont regroupés par <strong>prêteur</strong> (banque ou organisme). Pour chaque prêteur, vous voyez le total du capital restant dû, la mensualité globale et le nombre de prêts. Une barre de progression indique visuellement le taux de remboursement.
        </p>
      </HelpSection>

      <HelpSection id="types-emprunts" title="Les 3 types d'emprunts">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Emprunt amortissable</p>
            <p>Le type le plus courant. Chaque mensualité rembourse une partie du capital et une partie des intérêts. Le montant du capital remboursé augmente progressivement tandis que les intérêts diminuent.</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Exemple : prêt de 200 000 &euro; sur 20 ans à 2% &rarr; mensualité fixe d&apos;environ 1 012 &euro;</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Emprunt in fine</p>
            <p>Seuls les intérêts sont payés chaque mois. Le capital est remboursé en totalité à l&apos;échéance du prêt. Utilisé pour optimiser la fiscalité (intérêts déductibles) ou en attente de revente.</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Exemple : prêt de 200 000 &euro; sur 10 ans à 2.5% &rarr; mensualité de 417 &euro; (intérêts uniquement) + remboursement de 200 000 &euro; à la fin</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-2">Emprunt bullet (ballon)</p>
            <p>Aucun paiement intermédiaire : ni intérêts, ni capital. La totalité (capital + intérêts) est remboursée en un seul versement à l&apos;échéance. Rare, utilisé pour des financements relais de courte durée.</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection id="creer-emprunt" title="Créer un emprunt">
        <HelpStep number={1} title="Cliquez sur Nouvel emprunt">
          <p>Depuis la page Emprunts, cliquez sur le bouton <strong>Nouvel emprunt</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Renseignez les caractéristiques">
          <p>Libellé du prêt, type (amortissable, in fine, bullet), montant emprunté, taux d&apos;intérêt annuel, durée en mois, date de début, nom du prêteur.</p>
        </HelpStep>
        <HelpStep number={3} title="Associez à un immeuble (optionnel)">
          <p>Liez l&apos;emprunt à un immeuble pour calculer automatiquement le ratio LTV (Loan-to-Value) et suivre l&apos;endettement par bien.</p>
        </HelpStep>
        <HelpStep number={4} title="Consultez le tableau d'amortissement">
          <p>Une fois créé, {APP_NAME} génère automatiquement le tableau d&apos;amortissement complet : pour chaque échéance, vous voyez le capital remboursé, les intérêts, l&apos;assurance et le capital restant dû.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Formulaire de création d'emprunt" caption="Formulaire avec type, montant, taux, durée et prêteur" />
      </HelpSection>

      <HelpSection id="amortissement" title="Tableau d'amortissement">
        <p>
          Le tableau d&apos;amortissement détaille chaque échéance de votre emprunt :
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
        <ScreenshotPlaceholder alt="Tableau d'amortissement complet" caption="Vue complète du tableau d'amortissement avec toutes les échéances" />
      </HelpSection>

      <HelpSection id="ltv" title="Ratio LTV (Loan-to-Value)">
        <p>
          Le ratio LTV mesure l&apos;endettement par rapport à la valeur du patrimoine. Il est calculé automatiquement par {APP_NAME} :
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
    </HelpPageLayout>
  );
}
