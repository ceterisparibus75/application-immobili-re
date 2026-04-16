import { CalendarCheck } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Candidatures locataires | Centre d'aide | ${APP_NAME}`,
};

export default function CandidaturesPage() {
  return (
    <HelpPageLayout
      slug="candidatures"
      icon={<CalendarCheck className="h-6 w-6" />}
      title="Candidatures locataires"
      description="Gérez vos candidats locataires avec un pipeline visuel, notez les dossiers et suivez chaque étape de la sélection."
    >
      <HelpSection id="pipeline" title="Le pipeline de candidatures en 7 étapes">
        <p>
          Le module <strong>Candidatures</strong> fonctionne comme un pipeline commercial (type Kanban) adapté à la location immobilière. Chaque candidat progresse à travers 7 étapes :
        </p>
        <div className="space-y-2">
          {[
            { step: "1. Nouveau", color: "bg-gray-100 text-gray-700", desc: "Le candidat vient de se manifester (email, téléphone, portail)" },
            { step: "2. Contacté", color: "bg-blue-100 text-blue-700", desc: "Vous avez pris contact et échangé les premières informations" },
            { step: "3. Visite planifiée", color: "bg-indigo-100 text-indigo-700", desc: "Un rendez-vous de visite est fixé avec date et heure" },
            { step: "4. Visite effectuée", color: "bg-violet-100 text-violet-700", desc: "La visite a eu lieu, vous attendez le dossier du candidat" },
            { step: "5. Dossier reçu", color: "bg-amber-100 text-amber-700", desc: "Le candidat a transmis son dossier complet (pièces justificatives)" },
            { step: "6. Dossier validé", color: "bg-emerald-100 text-emerald-700", desc: "Le dossier est conforme et accepté après vérification" },
            { step: "7. Accepté", color: "bg-green-100 text-green-700", desc: "Le candidat est retenu — vous pouvez créer le bail" },
          ].map((s) => (
            <div key={s.step} className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${s.color}`}>{s.step}</span>
              <span className="text-sm">{s.desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-4">
          Les candidatures rejetées ou retirées sortent du pipeline actif mais restent consultables dans l'historique.
        </p>
      </HelpSection>

      <HelpSection id="creer" title="Créer une candidature">
        <HelpStep number={1} title="Accédez au module">
          <p>Depuis la barre de navigation, cliquez sur <strong>Candidatures</strong> (dans le menu Gestion locative).</p>
        </HelpStep>
        <HelpStep number={2} title="Nouvelle candidature">
          <p>Cliquez sur <strong>Nouvelle candidature</strong>. Renseignez le nom du candidat, son email, son téléphone et le lot visé.</p>
        </HelpStep>
        <HelpStep number={3} title="Évaluez et notez">
          <p>Attribuez un score au dossier (revenus, stabilité professionnelle, garants). Le tableau classe automatiquement les candidats du meilleur score au plus bas.</p>
        </HelpStep>
        <HelpStep number={4} title="Faites avancer dans le pipeline">
          <p>À chaque étape franchie, changez le statut. Quand le candidat est accepté, vous pouvez créer directement un bail depuis sa fiche.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Vous avez un T3 vacant à Lyon. 4 candidats se manifestent. Vous les ajoutez au pipeline, planifiez les visites, recevez les dossiers. Jean Dupont obtient un score de 87/100 (CDI cadre, revenus 3&times; le loyer, garant solide). Marie Martin obtient 72/100 (CDD mais garant bancaire). Vous acceptez Jean Dupont et créez son bail directement depuis la fiche candidature.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="scoring" title="Système de scoring">
        <p>
          Le score permet de comparer objectivement les candidatures. Le tableau de bord affiche le <strong>score moyen</strong> de toutes les candidatures actives et les trie par score décroissant (puis par date de création).
        </p>
        <InfoBox type="tip">
          Définissez vos critères de notation en amont : revenus &ge; 3&times; le loyer, type de contrat (CDI/CDD), présence d'un garant, ancienneté professionnelle. Cela vous aide à prendre des décisions objectives et non-discriminatoires.
        </InfoBox>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur les candidatures">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment rejeter une candidature ?</p>
            <p>Depuis la fiche du candidat, changez le statut en &laquo; Rejeté &raquo;. La candidature sort du pipeline actif mais reste dans l'historique. Vous pouvez ajouter un motif de rejet pour traçabilité.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Puis-je convertir une candidature acceptée en bail ?</p>
            <p>Oui, une fois le statut passé à &laquo; Accepté &raquo;, un bouton <strong>Créer le bail</strong> apparaît. Les informations du candidat (nom, email, téléphone) sont pré-remplies dans le formulaire de bail.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment voir le score moyen de mes candidatures ?</p>
            <p>Le tableau de bord en haut de la page Candidatures affiche deux indicateurs : le nombre total de candidatures actives et le score moyen. Cela vous donne une vue d'ensemble de la qualité de votre vivier.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
