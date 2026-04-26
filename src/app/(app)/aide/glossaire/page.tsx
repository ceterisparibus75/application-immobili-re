import { BookOpen } from "lucide-react";
import { HelpPageLayout, HelpSection, InfoBox } from "../_components/help-page-layout";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Glossaire immobilier | Centre d'aide | ${APP_NAME}`,
};

type Term = { term: string; definition: string };

function GlossaryGroup({ letter, terms }: { letter: string; terms: Term[] }) {
  return (
    <div>
      <h3 className="text-base font-bold text-primary mb-3 pb-1 border-b border-primary/20">{letter}</h3>
      <div className="space-y-3">
        {terms.map((t) => (
          <div key={t.term} className="rounded-lg border p-4">
            <p className="font-semibold text-foreground mb-1">{t.term}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GlossairePage() {
  return (
    <HelpPageLayout
      slug="glossaire"
      icon={<BookOpen className="h-6 w-6" />}
      title="Glossaire immobilier"
      description="Définitions des termes juridiques, comptables et techniques utilisés dans la gestion locative et dans l'application."
    >
      <HelpSection id="intro" title="Comment utiliser ce glossaire">
        <p>
          Ce glossaire regroupe les termes les plus fréquents rencontrés dans la gestion locative, la comptabilité immobilière et dans l'application. Les définitions sont volontairement accessibles et illustrées d'exemples concrets.
        </p>
        <InfoBox type="tip">
          Utilisez la fonction de recherche en haut du centre d'aide pour trouver rapidement un terme. Sur cette page, les termes sont classés par ordre alphabétique.
        </InfoBox>
      </HelpSection>

      <HelpSection id="a-b" title="A — B">
        <div className="space-y-6">
          <GlossaryGroup
            letter="A"
            terms={[
              {
                term: "Amortissement",
                definition:
                  "Étalement comptable du coût d'un bien sur sa durée de vie. En immobilier, un immeuble est généralement amorti sur 30 à 50 ans. L'amortissement réduit le bénéfice imposable sans sortie de trésorerie.",
              },
              {
                term: "Appel de charges",
                definition:
                  "Montant provisionnel demandé au locataire chaque mois pour couvrir les charges récupérables (eau, entretien parties communes, etc.). Une régularisation annuelle compare les provisions versées aux charges réelles.",
              },
              {
                term: "Assurance loyers impayés (GLI / ALI)",
                definition:
                  "Garantie souscrite par le propriétaire pour se prémunir contre les impayés de loyer. L'assureur prend en charge les loyers non perçus, les frais de procédure et parfois les dégradations, sous réserve de critères d'éligibilité du locataire.",
              },
              {
                term: "Avenant au bail",
                definition:
                  "Document modifiant une ou plusieurs clauses d'un bail en cours sans le résilier. Exemples : changement de loyer, ajout d'un colocataire, autorisation d'un sous-bail. L'avenant doit être signé des deux parties.",
              },
            ]}
          />
          <GlossaryGroup
            letter="B"
            terms={[
              {
                term: "Bail",
                definition:
                  "Contrat de location entre un propriétaire (bailleur) et un locataire (preneur). Il fixe la durée, le loyer, les charges et les conditions d'usage du logement. En location nue, la durée minimale est de 3 ans (6 ans pour les personnes morales). En meublé, elle est de 1 an (9 mois pour les étudiants).",
              },
              {
                term: "Bail commercial",
                definition:
                  "Contrat de location d'un local à usage commercial, artisanal ou industriel. Durée minimale de 9 ans avec droit au renouvellement. Le loyer est révisable triennalement selon l'ILC ou l'ILAT.",
              },
              {
                term: "BIC (Bénéfices Industriels et Commerciaux)",
                definition:
                  "Régime fiscal applicable aux locations meublées. Contrairement aux revenus fonciers (location nue), les revenus de location meublée sont imposés dans la catégorie BIC.",
              },
            ]}
          />
        </div>
      </HelpSection>

      <HelpSection id="c-d" title="C — D">
        <div className="space-y-6">
          <GlossaryGroup
            letter="C"
            terms={[
              {
                term: "Caution",
                definition:
                  "Personne physique ou morale qui s'engage à payer les loyers et charges à la place du locataire en cas de défaillance. La caution simple permet au propriétaire d'agir contre le locataire d'abord. La caution solidaire lui permet d'agir directement contre la caution dès le premier impayé.",
              },
              {
                term: "Charges récupérables",
                definition:
                  "Dépenses engagées par le propriétaire mais refacturables au locataire, définies par décret (décret du 26 août 1987 pour les baux nus). Elles comprennent notamment : eau froide, entretien des parties communes, ascenseur, taxe sur les ordures ménagères, etc.",
              },
              {
                term: "Compte rendu de gestion",
                definition:
                  "Rapport périodique (mensuel ou trimestriel) envoyé par un gestionnaire immobilier au propriétaire, récapitulant les loyers encaissés, les charges, les impayés et les travaux réalisés.",
              },
              {
                term: "Copropriété",
                definition:
                  "Mode d'organisation d'un immeuble appartenant à plusieurs propriétaires (copropriétaires). Chacun détient des lots privatifs et une quote-part des parties communes (tantièmes). Un syndic gère les parties communes et un règlement de copropriété fixe les règles.",
              },
            ]}
          />
          <GlossaryGroup
            letter="D"
            terms={[
              {
                term: "DDT (Dossier de Diagnostics Techniques)",
                definition:
                  "Ensemble des diagnostics obligatoires à fournir au locataire à la signature du bail : DPE, diagnostic amiante (avant 1997), plomb (CREP, avant 1949), électricité, gaz, ERNMT (risques naturels), etc. La liste varie selon le type et l'ancienneté du logement.",
              },
              {
                term: "Dépôt de garantie",
                definition:
                  "Somme versée par le locataire à l'entrée du logement, conservée par le propriétaire jusqu'à la restitution du bien. En location nue : 1 mois de loyer hors charges max. En meublé : 2 mois max. Elle couvre les éventuels impayés ou dégradations non imputables à la vétusté.",
              },
              {
                term: "DPE (Diagnostic de Performance Énergétique)",
                definition:
                  "Estimation de la consommation énergétique et des émissions de CO₂ d'un logement, exprimée par une note de A (très économe) à G (passoire thermique). Obligatoire lors de toute location. Les logements classés G sont interdits à la location depuis 2025.",
              },
            ]}
          />
        </div>
      </HelpSection>

      <HelpSection id="e-f" title="E — F">
        <div className="space-y-6">
          <GlossaryGroup
            letter="E"
            terms={[
              {
                term: "État des lieux",
                definition:
                  "Document descriptif établi contradictoirement (propriétaire + locataire) lors de l'entrée dans le logement et lors de la sortie. Il sert à comparer l'état du bien et à déterminer les éventuelles dégradations imputables au locataire.",
              },
              {
                term: "Encadrement des loyers",
                definition:
                  "Dispositif légal limitant le montant des loyers dans certaines zones tendues (Paris, Lille, Bordeaux, etc.). Un loyer de référence majoré est fixé par arrêté préfectoral. Dépasser ce plafond expose le propriétaire à des sanctions.",
              },
            ]}
          />
          <GlossaryGroup
            letter="F"
            terms={[
              {
                term: "FEC (Fichier des Écritures Comptables)",
                definition:
                  "Format réglementaire DGFiP (Article A.47 A-1) que tout professionnel soumis au régime réel doit être capable de produire en cas de contrôle fiscal. Il liste toutes les écritures comptables de l'exercice en format tabulé (séparateur tabulation, UTF-8).",
              },
              {
                term: "Franchise de loyer",
                definition:
                  "Période convenue dans le bail pendant laquelle le locataire ne paie pas de loyer (ou paie un loyer réduit). Souvent accordée pour des travaux que le locataire réalise dans le logement.",
              },
            ]}
          />
        </div>
      </HelpSection>

      <HelpSection id="g-i" title="G — I">
        <div className="space-y-6">
          <GlossaryGroup
            letter="G"
            terms={[
              {
                term: "Garantie Visale",
                definition:
                  "Caution gratuite accordée par Action Logement aux jeunes de moins de 30 ans et aux salariés précaires. Elle remplace le dépôt de garantie et se substitue au garant personne physique.",
              },
              {
                term: "Gestionnaire de biens",
                definition:
                  "Professionnel (ou société) mandaté par un propriétaire pour gérer ses biens locatifs : recherche de locataires, gestion des loyers et des impayés, suivi des travaux, relation avec les locataires.",
              },
            ]}
          />
          <GlossaryGroup
            letter="I"
            terms={[
              {
                term: "ICC (Indice du Coût de la Construction)",
                definition:
                  "Indice publié trimestriellement par l'INSEE, utilisé pour réviser les loyers des baux commerciaux signés avant le 1er septembre 2014. Il mesure l'évolution du coût de la construction neuve.",
              },
              {
                term: "ILC (Indice des Loyers Commerciaux)",
                definition:
                  "Indice trimestriel INSEE servant de référence pour réviser les loyers des baux commerciaux portant sur des activités commerciales ou artisanales. Il prend en compte l'IPC, le PIB tertiaire et l'ICC.",
              },
              {
                term: "ILAT (Indice des Loyers des Activités Tertiaires)",
                definition:
                  "Indice trimestriel INSEE pour les baux de locaux à usage de bureaux, entrepôts logistiques ou activités tertiaires non commerciales. Calculé à partir de l'IPC, du PIB et de l'ICC.",
              },
              {
                term: "IRL (Indice de Référence des Loyers)",
                definition:
                  "Indice trimestriel INSEE permettant de réviser les loyers des logements (nus ou meublés). Publié chaque trimestre (T1 à T4), il évolue selon l'inflation. La révision s'applique à la date anniversaire du bail, dans la limite de la variation de l'IRL.",
              },
            ]}
          />
        </div>
      </HelpSection>

      <HelpSection id="l-m" title="L — M">
        <div className="space-y-6">
          <GlossaryGroup
            letter="L"
            terms={[
              {
                term: "Loi Alur",
                definition:
                  "Loi du 24 mars 2014 renforçant les droits des locataires : encadrement des loyers, dossier de location plafonné, garantie universelle des loyers (partiellement appliquée), obligation d'état des lieux d'entrée, délai de préavis réduit en zone tendue.",
              },
              {
                term: "LTV (Loan-to-Value)",
                definition:
                  "Ratio exprimant le montant du prêt immobilier par rapport à la valeur du bien financé. Un LTV de 80 % signifie que le prêt représente 80 % de la valeur du bien (l'emprunteur apporte 20 % en fonds propres). Plus le LTV est élevé, plus le risque pour la banque est important.",
              },
            ]}
          />
          <GlossaryGroup
            letter="M"
            terms={[
              {
                term: "Mandat de gestion",
                definition:
                  "Contrat par lequel un propriétaire confie la gestion de son bien à un professionnel (agent immobilier ou administrateur de biens). Le mandataire agit au nom du propriétaire dans le cadre de pouvoirs définis.",
              },
              {
                term: "Meublé de tourisme",
                definition:
                  "Logement loué à une clientèle de passage ne souhaitant pas y élire domicile. La location peut se faire via des plateformes type Airbnb. En zone tendue, une autorisation préalable de changement d'usage peut être nécessaire.",
              },
            ]}
          />
        </div>
      </HelpSection>

      <HelpSection id="p-r" title="P — R">
        <div className="space-y-6">
          <GlossaryGroup
            letter="P"
            terms={[
              {
                term: "Palier de loyer",
                definition:
                  "Clause contractuelle prévoyant une augmentation progressive du loyer par étapes successives, généralement à des dates précises. Utilisé dans les baux commerciaux pour alléger les charges initiales du preneur.",
              },
              {
                term: "PLI / PLS / PLUS",
                definition:
                  "Régimes de financement de logements sociaux (Prêt Locatif Intermédiaire, Prêt Locatif Social, Prêt Locatif à Usage Social). Ils imposent des plafonds de loyer et de ressources des locataires en contrepartie d'avantages fiscaux et de prêts bonifiés.",
              },
              {
                term: "Préavis",
                definition:
                  "Délai de prévenance avant la résiliation d'un bail. En location nue : 3 mois pour le locataire (1 mois en zone tendue), 6 mois pour le propriétaire. En meublé : 1 mois pour le locataire, 3 mois pour le propriétaire.",
              },
              {
                term: "Provision sur charges",
                definition:
                  "Voir Appel de charges. Montant versé mensuellement par le locataire à titre provisionnel pour les charges récupérables, régularisé annuellement.",
              },
            ]}
          />
          <GlossaryGroup
            letter="R"
            terms={[
              {
                term: "Rapprochement bancaire",
                definition:
                  "Opération consistant à confronter les mouvements du relevé bancaire avec les écritures comptables pour vérifier leur concordance. Dans l'application, il s'agit d'associer une transaction bancaire à la facture ou au paiement correspondant.",
              },
              {
                term: "Régularisation des charges",
                definition:
                  "Calcul annuel permettant de comparer les provisions de charges versées par le locataire aux charges réelles. Si les provisions sont supérieures aux charges, le propriétaire rembourse. Dans le cas contraire, le locataire paie le complément.",
              },
              {
                term: "Relevé de gérance",
                definition:
                  "Document comptable fourni par un administrateur de biens au propriétaire, détaillant les encaissements, décaissements et honoraires sur une période donnée.",
              },
              {
                term: "Rentabilité brute",
                definition:
                  "Rapport entre les loyers annuels bruts et le prix d'acquisition du bien (frais inclus), exprimé en pourcentage. Exemple : loyer annuel 12 000 € / prix 200 000 € = 6 % de rentabilité brute.",
              },
              {
                term: "RGPD (Règlement Général sur la Protection des Données)",
                definition:
                  "Règlement européen 2016/679 encadrant la collecte et le traitement des données personnelles. En gestion locative, il impose notamment de ne conserver les données des anciens locataires que 3 à 5 ans après la fin du bail.",
              },
            ]}
          />
        </div>
      </HelpSection>

      <HelpSection id="s-z" title="S — Z">
        <div className="space-y-6">
          <GlossaryGroup
            letter="S"
            terms={[
              {
                term: "SCI (Société Civile Immobilière)",
                definition:
                  "Société civile créée pour détenir et gérer un ou plusieurs biens immobiliers. Elle permet notamment de faciliter la transmission du patrimoine, de répartir les revenus entre associés et de déduire les intérêts d'emprunt.",
              },
              {
                term: "SEPA (Single Euro Payments Area)",
                definition:
                  "Espace européen de paiement unifié permettant les virements et prélèvements en euros dans 36 pays avec les mêmes normes (IBAN, BIC). Le prélèvement SEPA permet au propriétaire de débiter directement le compte du locataire avec son accord (mandat).",
              },
              {
                term: "SIRET",
                definition:
                  "Numéro d'identification à 14 chiffres attribué à chaque établissement d'une entreprise. Il est composé du SIREN (9 chiffres) suivi d'un code NIC (5 chiffres). Requis pour l'émission de factures électroniques B2B.",
              },
              {
                term: "Soft delete",
                definition:
                  "Technique informatique consistant à marquer un enregistrement comme supprimé sans l'effacer physiquement de la base de données. Dans l'application, les locataires, baux et documents supprimés restent en base pour des raisons légales (conservation des données).",
              },
              {
                term: "Sous-bail (ou sous-location)",
                definition:
                  "Location par un locataire d'une partie ou de la totalité du logement à un tiers (sous-locataire). En principe interdite sans accord écrit du propriétaire. Le loyer perçu ne peut excéder celui payé au propriétaire.",
              },
            ]}
          />
          <GlossaryGroup
            letter="T"
            terms={[
              {
                term: "Tantième",
                definition:
                  "Quote-part exprimée en millièmes (ou dix-millièmes) attribuée à chaque lot dans une copropriété. Les tantièmes servent à répartir les charges communes et le droit de vote en assemblée générale.",
              },
              {
                term: "Taxe foncière",
                definition:
                  "Impôt local annuel dû par le propriétaire du bien au 1er janvier de l'année. La part récupérable sur le locataire est uniquement la taxe d'enlèvement des ordures ménagères (TEOM), incluse dans les charges récupérables.",
              },
              {
                term: "Taux de vacance",
                definition:
                  "Pourcentage de la période pendant laquelle un bien est inoccupé (sans locataire). Un taux de vacance élevé signale un problème de commercialisation ou de prix.",
              },
            ]}
          />
          <GlossaryGroup
            letter="V"
            terms={[
              {
                term: "Valeur vénale",
                definition:
                  "Prix auquel un bien immobilier pourrait être cédé dans des conditions normales de marché (acheteur et vendeur indépendants, bien exposé suffisamment longtemps). Estimée par l'application via son module d'évaluation patrimoniale IA.",
              },
              {
                term: "Vétusté",
                definition:
                  "Usure naturelle d'un bien ou d'un équipement liée au temps et à un usage normal. Elle ne peut être imputée au locataire lors de la restitution du dépôt de garantie. Une grille de vétusté peut être annexée au bail pour objectiver cette usure.",
              },
            ]}
          />
          <GlossaryGroup
            letter="Z"
            terms={[
              {
                term: "Zone tendue",
                definition:
                  "Zone géographique où la demande de logements est très supérieure à l'offre (liste fixée par décret). En zone tendue : préavis réduit à 1 mois pour le locataire, encadrement des loyers applicable, taxe d'habitation sur résidences secondaires majorée.",
              },
            ]}
          />
        </div>
      </HelpSection>
    </HelpPageLayout>
  );
}
