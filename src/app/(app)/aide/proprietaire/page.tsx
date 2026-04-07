import { Layers } from "lucide-react";
import { HelpPageLayout, HelpSection, HelpStep, ScreenshotPlaceholder, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Vue Propriétaire | Centre d'aide | ${APP_NAME}`,
};

export default function ProprietairePage() {
  return (
    <HelpPageLayout
      slug="proprietaire"
      icon={<Layers className="h-6 w-6" />}
      title="Vue Propriétaire"
      description="Tableau de bord consolidé pour piloter toutes vos sociétés d'un seul coup d'œil, gérer les co-propriétaires et envoyer des rapports."
    >
      <HelpSection id="concept" title="Qu'est-ce qu'un propriétaire ?">
        <p>
          Dans {APP_NAME}, un <strong>propriétaire</strong> est l&apos;entité qui détient une ou plusieurs sociétés (SCI, SARL, personne physique, etc.). C&apos;est le niveau le plus élevé de l&apos;arborescence :
        </p>
        <div className="rounded-lg border p-4 bg-muted/20 font-mono text-sm">
          <p>Propriétaire (personne physique ou morale)</p>
          <p className="pl-4">&rarr; Société 1 (SCI Soleil)</p>
          <p className="pl-8">&rarr; Immeuble A</p>
          <p className="pl-12">&rarr; Lot 1, Lot 2, Lot 3</p>
          <p className="pl-4">&rarr; Société 2 (SARL Horizon)</p>
          <p className="pl-8">&rarr; Immeuble B</p>
          <p className="pl-12">&rarr; Lot 4, Lot 5</p>
        </div>
        <p>
          Un propriétaire peut être une <strong>personne physique</strong> (un particulier ou un couple) ou une <strong>personne morale</strong> (une société : SCI, SARL, SAS, etc.).
        </p>
        <InfoBox type="info">
          Le propriétaire est créé automatiquement la première fois que vous créez une société. Vous pouvez le personnaliser ensuite depuis l&apos;onglet Profil Propriétaire.
        </InfoBox>
      </HelpSection>

      <HelpSection id="dashboard" title="Tableau de bord consolidé">
        <p>
          L&apos;onglet <strong>Tableau de bord</strong> de la vue Propriétaire affiche des KPI agrégés sur toutes les sociétés du propriétaire sélectionné :
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Revenus mensuels", desc: "Total des loyers perçus sur toutes les sociétés" },
            { title: "Taux d'occupation", desc: "Pourcentage de lots occupés vs lots totaux" },
            { title: "Impayés", desc: "Montant total des factures en retard" },
            { title: "Trésorerie", desc: "Solde de trésorerie disponible sur tous les comptes" },
          ].map((kpi) => (
            <div key={kpi.title} className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">{kpi.title}</p>
              <p className="text-xs text-muted-foreground">{kpi.desc}</p>
            </div>
          ))}
        </div>
        <ScreenshotPlaceholder alt="Dashboard propriétaire" caption="KPI consolidés avec revenus, occupation, impayés et trésorerie" />

        <p className="font-semibold text-foreground mt-6 mb-2">Tableau de performance par société :</p>
        <p>
          Sous les KPI, un tableau compare les performances de chaque société : revenus mensuels, trésorerie, taux d&apos;occupation. Cela permet d&apos;identifier rapidement les sociétés qui performent et celles qui nécessitent une attention particulière.
        </p>
        <ScreenshotPlaceholder alt="Tableau de performance" caption="Comparaison des sociétés avec revenus, cash et occupation" />

        <p className="font-semibold text-foreground mt-6 mb-2">Graphiques interactifs :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Revenus mensuels</strong> : évolution sur 12 mois, toutes sociétés confondues</li>
          <li><strong>Occupation par immeuble</strong> : lots occupés vs vacants par bâtiment</li>
          <li><strong>Impayés par ancienneté</strong> : répartition 0-30j, 30-60j, 60j+</li>
          <li><strong>Évolution du patrimoine</strong> : valeur totale dans le temps</li>
          <li><strong>Concentration des risques</strong> : poids de chaque locataire dans les revenus</li>
          <li><strong>Timeline des baux</strong> : échéances à venir</li>
        </ul>
      </HelpSection>

      <HelpSection id="societes" title="Onglet Sociétés">
        <p>
          L&apos;onglet <strong>Sociétés</strong> affiche les sociétés rattachées au propriétaire sous forme de cartes. Chaque carte montre le nom, la forme juridique, le SIRET, la ville, le statut (active/inactive) et votre rôle.
        </p>
        <p>
          Vous pouvez créer une nouvelle société directement depuis cet onglet via le bouton <strong>Nouvelle société</strong>. La société sera automatiquement rattachée au propriétaire sélectionné.
        </p>
        <ScreenshotPlaceholder alt="Liste des sociétés du propriétaire" caption="Cartes des sociétés avec nom, forme juridique et statut" />
      </HelpSection>

      <HelpSection id="profil" title="Onglet Profil Propriétaire">
        <p>
          L&apos;onglet <strong>Profil Propriétaire</strong> affiche et permet de modifier les informations du propriétaire sélectionné.
        </p>

        <p className="font-semibold text-foreground mt-4 mb-2">Pour une personne physique :</p>
        <p>
          Prénom, nom, email (pour l&apos;envoi de rapports), téléphone, date et lieu de naissance, profession, nationalité, adresse complète.
        </p>

        <p className="font-semibold text-foreground mt-4 mb-2">Pour une personne morale :</p>
        <p>
          Dénomination sociale, forme juridique (SCI, SARL, SAS, etc.), SIRET, SIREN, capital social, numéro de TVA intracommunautaire, ville du RCS, représentant légal (nom et fonction), téléphone, siège social.
        </p>

        <ScreenshotPlaceholder alt="Fiche propriétaire" caption="Formulaire de profil avec tous les champs d'identité et d'adresse" />

        <InfoBox type="tip">
          Le champ <strong>Email</strong> du propriétaire est distinct de l&apos;email de votre compte utilisateur. Il sert spécifiquement à l&apos;envoi de rapports et de documents officiels au nom du propriétaire.
        </InfoBox>
      </HelpSection>

      <HelpSection id="co-proprietaires" title="Co-propriétaires (associés)">
        <p>
          Pour un propriétaire de type personne physique, vous pouvez déclarer des <strong>co-propriétaires</strong> (associés). C&apos;est utile pour les indivisions, les couples, ou toute détention partagée.
        </p>
        <HelpStep number={1} title="Passez en mode édition">
          <p>Depuis l&apos;onglet Profil Propriétaire, cliquez sur <strong>Modifier</strong>.</p>
        </HelpStep>
        <HelpStep number={2} title="Ajoutez un co-propriétaire">
          <p>Dans la section <strong>Co-propriétaires</strong> en bas du formulaire, cliquez sur <strong>Ajouter</strong>.</p>
        </HelpStep>
        <HelpStep number={3} title="Renseignez les informations">
          <p>Pour chaque co-propriétaire : prénom, nom (obligatoires), email, téléphone, part de détention (ex: 50%, 1/3), qualité (co-propriétaire, usufruitier, nu-propriétaire, indivisaire), date et lieu de naissance, nationalité.</p>
        </HelpStep>
        <HelpStep number={4} title="Sauvegardez">
          <p>Cliquez sur <strong>Sauvegarder</strong>. Les co-propriétaires sont enregistrés et affichés dans des cartes individuelles en lecture seule.</p>
        </HelpStep>
        <ScreenshotPlaceholder alt="Section co-propriétaires" caption="Formulaire d'ajout de co-propriétaires avec part et qualité" />
        <InfoBox type="info">
          Les co-propriétaires ne sont disponibles que pour les propriétaires de type personne physique. Pour une personne morale (société), le représentant légal est renseigné dans la fiche principale.
        </InfoBox>
      </HelpSection>

      <HelpSection id="selecteur" title="Sélecteur de propriétaire">
        <p>
          Si vous gérez plusieurs propriétaires, un sélecteur apparaît en haut de la page. Il affiche le propriétaire actif avec son libellé et le nombre de sociétés rattachées. Cliquez dessus pour basculer vers un autre propriétaire.
        </p>
        <p>
          Le sélecteur est également visible dans la barre de navigation principale (à gauche du sélecteur de société), permettant de changer de propriétaire depuis n&apos;importe quelle page.
        </p>
        <ScreenshotPlaceholder alt="Sélecteur de propriétaire" caption="Menu déroulant avec la liste des propriétaires et leurs sociétés" />
      </HelpSection>

      <HelpSection id="revendiquer" title="Revendiquer une société">
        <p>
          Si une société vous appartient mais n&apos;est pas encore rattachée à un propriétaire, un bouton <strong>Revendiquer des sociétés</strong> apparaît en haut de la page. Cliquez dessus pour rattacher la société au propriétaire de votre choix.
        </p>
        <InfoBox type="info">
          Cette situation peut se produire si la société a été créée avant la mise en place du système propriétaire, ou si elle a été créée par un autre utilisateur qui vous a ensuite donné les droits d&apos;administration.
        </InfoBox>
      </HelpSection>
    </HelpPageLayout>
  );
}
