import { Building } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Copropriété | Centre d'aide | ${APP_NAME}`,
};

export default function CoproprietePage() {
  return (
    <HelpPageLayout
      slug="copropriete"
      icon={<Building className="h-6 w-6" />}
      title="Copropriété"
      description="Gérez les copropriétés : tantièmes, assemblées générales, budgets prévisionnels et appels de fonds."
    >
      <HelpSection id="concept" title="Qu'est-ce qu'une copropriété dans MyGestia ?">
        <p>
          Le module <strong>Copropriété</strong> vous permet de gérer les immeubles en copropriété : répartition des tantièmes entre copropriétaires, organisation des assemblées générales (AG), suivi des budgets prévisionnels et appels de fonds.
        </p>
        <p>
          Une copropriété est liée à un immeuble existant dans votre patrimoine. Chaque lot de l'immeuble se voit attribuer des tantièmes qui déterminent sa quote-part dans les charges communes.
        </p>
      </HelpSection>

      <HelpSection id="creer" title="Créer une copropriété">
        <HelpStep number={1} title="Accédez au module">
          <p>Depuis le menu <strong>Modules &gt; Copropriété</strong>, cliquez sur <strong>Nouvelle copropriété</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Sélectionnez l'immeuble">
          <p>Choisissez l'immeuble concerné parmi votre patrimoine. Les lots de l'immeuble sont automatiquement listés.</p>
        </HelpStep>
        <HelpStep number={3} title="Définissez les tantièmes">
          <p>Pour chaque lot, renseignez le nombre de tantièmes (millièmes). Le total doit correspondre à 1 000/1 000 ou 10 000/10 000 selon votre convention.</p>
        </HelpStep>
        <HelpStep number={4} title="Configurez le budget prévisionnel">
          <p>Définissez le budget annuel de la copropriété par catégorie de charges (entretien, ascenseur, gardiennage, assurance, etc.). Les appels de fonds sont calculés au prorata des tantièmes.</p>
        </HelpStep>
        <div className="rounded-lg border p-4 bg-muted/20">
          <p className="text-sm text-foreground mb-2 font-semibold">Exemple concret :</p>
          <p className="text-sm">
            Immeuble &laquo; Résidence du Parc &raquo; — 10 lots. Budget annuel : 24 000 &euro;. L'Apt 1A (80 tantièmes sur 1 000) paie 80/1 000 &times; 24 000 = 1 920 &euro;/an, soit 160 &euro;/mois d'appel de fonds. L'Apt 5C (150 tantièmes) paie 3 600 &euro;/an, soit 300 &euro;/mois.
          </p>
        </div>
      </HelpSection>

      <HelpSection id="ag" title="Assemblées générales">
        <p>
          Depuis la fiche copropriété, vous pouvez organiser les assemblées générales :
        </p>
        <HelpStep number={1} title="Planifiez l'AG">
          <p>Cliquez sur <strong>Nouvelle AG</strong>. Renseignez la date, l'heure, le lieu et l'ordre du jour avec les résolutions à voter.</p>
        </HelpStep>
        <HelpStep number={2} title="Enregistrez les votes">
          <p>Pour chaque résolution, notez le résultat : adoptée, rejetée ou ajournée, avec le détail des votes par tantièmes.</p>
        </HelpStep>
        <HelpStep number={3} title="Générez le PV">
          <p>Le procès-verbal est généré automatiquement avec les résultats et peut être envoyé aux copropriétaires par email.</p>
        </HelpStep>
        <InfoBox type="info">
          Les décisions en AG suivent les règles de majorité prévues par la loi du 10 juillet 1965 : majorité simple (art. 24), majorité absolue (art. 25), double majorité (art. 26).
        </InfoBox>
      </HelpSection>

      <HelpSection id="faq" title="Questions fréquentes sur la copropriété">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment modifier les tantièmes d'un lot ?</p>
            <p>Depuis la fiche copropriété, cliquez sur <strong>Modifier</strong> puis ajustez les tantièmes de chaque lot. Attention : une modification des tantièmes nécessite normalement un vote en AG.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Comment créer un appel de fonds trimestriel ?</p>
            <p>Le budget prévisionnel annuel est automatiquement divisé en appels trimestriels au prorata des tantièmes. Chaque copropriétaire reçoit un appel correspondant à sa quote-part.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">Le module copropriété est-il inclus dans tous les plans ?</p>
            <p>Oui, la gestion de copropriété est disponible dès le plan Starter.</p>
          </div>
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
