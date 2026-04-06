import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { articles, getArticleBySlug, getCategoryColor } from "../_data/articles";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";
const SITE_URL = process.env.AUTH_URL ?? "https://app.mygestia.immo";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      publishedTime: article.date,
    },
  };
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Article content by slug ──────────────────────────────────────────

const ARTICLE_CONTENT: Record<string, React.ReactNode> = {
  "gerer-fonciere-multi-immeubles": (
    <>
      <p>
        La gestion d&apos;une foncière détenant plusieurs immeubles implique des
        enjeux de consolidation financière, de suivi opérationnel par entité et de
        reporting fiable. Sans un outil structuré, la multiplication des lots et des
        baux génère une complexité qui expose à des erreurs comptables et à une perte
        de visibilité sur la performance réelle du patrimoine.
      </p>

      <h2>Structurer le patrimoine par société et par immeuble</h2>
      <p>
        La première étape consiste à organiser le portefeuille en entités juridiques
        distinctes — SCI, SARL, SAS — chacune regroupant un ou plusieurs immeubles.
        Cette structuration permet d&apos;isoler les responsabilités fiscales, de
        faciliter les cessions et d&apos;obtenir un reporting consolidé ou par entité.
      </p>
      <p>
        Un logiciel de gestion immobilière doit refléter cette hiérarchie :
        propriétaire → société → immeuble → lot. Chaque niveau porte ses propres
        indicateurs (taux d&apos;occupation, rendement, endettement) qui se
        consolident automatiquement.
      </p>

      <h2>Consolider les flux financiers</h2>
      <p>
        Les revenus locatifs, les charges, les remboursements d&apos;emprunts et les
        travaux doivent être réconciliés en temps réel. Le rapprochement bancaire
        automatisé compare les mouvements du compte courant avec les factures émises
        et les charges enregistrées, réduisant le risque d&apos;écarts.
      </p>
      <p>
        La consolidation inter-sociétés permet ensuite de produire un tableau de bord
        global affichant le cash-flow net, le taux d&apos;occupation moyen et le
        rendement brut de l&apos;ensemble du portefeuille.
      </p>

      <h2>Automatiser la facturation et les révisions</h2>
      <p>
        La facturation récurrente — loyers, provisions sur charges, taxe foncière
        refacturée — doit être générée automatiquement chaque mois. Les révisions de
        loyer selon les indices IRL, ILC ou ILAT doivent s&apos;appliquer aux dates
        anniversaires des baux, sans intervention manuelle.
      </p>

      <h2>Suivre la vacance et anticiper les échéances</h2>
      <p>
        Le taux de vacance est un indicateur critique. Un tableau de bord doit alerter
        sur les baux arrivant à échéance dans les 90 prochains jours et sur les lots
        vacants depuis plus de 30 jours. Cette anticipation permet de planifier les
        travaux de remise en état et la commercialisation en amont.
      </p>

      <h2>Produire un reporting institutionnel</h2>
      <p>
        Les investisseurs et les associés attendent des rapports normalisés : situation
        locative, compte-rendu de gestion annuel, état des impayés, tableau de
        rentabilité par lot. Ces documents doivent être générés en un clic, au format
        PDF ou Excel, avec le branding de la société gestionnaire.
      </p>
    </>
  ),

  "rgpd-gestion-immobiliere": (
    <>
      <p>
        Le Règlement Général sur la Protection des Données (RGPD) s&apos;applique
        pleinement à la gestion immobilière. Les propriétaires et gestionnaires
        collectent, traitent et conservent des données personnelles sensibles :
        identité des locataires, coordonnées bancaires, pièces d&apos;identité,
        bulletins de salaire.
      </p>

      <h2>Les bases légales du traitement</h2>
      <p>
        Le traitement des données locataires repose principalement sur deux bases
        légales : l&apos;exécution du contrat (bail) et l&apos;obligation légale
        (conservation comptable). Le consentement n&apos;est nécessaire que pour les
        traitements non contractuels, comme l&apos;envoi de communications
        commerciales.
      </p>

      <h2>Durées de conservation obligatoires</h2>
      <p>
        Les durées de conservation varient selon la nature des données :
      </p>
      <ul>
        <li><strong>Locataire actif :</strong> conservation pendant toute la durée du bail</li>
        <li><strong>Locataire archivé :</strong> 5 ans après la fin du bail (prescription civile)</li>
        <li><strong>Documents d&apos;identité :</strong> 3 ans après la fin de la relation contractuelle</li>
        <li><strong>Données bancaires :</strong> 10 ans (obligation comptable)</li>
        <li><strong>Logs d&apos;audit :</strong> 1 an</li>
        <li><strong>Consentements :</strong> 3 ans après révocation</li>
      </ul>

      <h2>Chiffrement des données sensibles</h2>
      <p>
        Les coordonnées bancaires (IBAN, BIC) doivent être chiffrées au repos. Le
        standard recommandé est l&apos;AES-256-GCM, qui assure à la fois la
        confidentialité et l&apos;intégrité des données. Le déchiffrement ne doit
        intervenir qu&apos;au moment de l&apos;utilisation (génération SEPA, affichage
        autorisé).
      </p>

      <h2>Droits des locataires</h2>
      <p>
        Les locataires disposent de droits d&apos;accès, de rectification, de
        suppression et de portabilité. Le gestionnaire doit être en mesure de répondre
        à ces demandes dans un délai d&apos;un mois. Un registre des traitements et
        un processus de traitement des demandes sont indispensables.
      </p>

      <h2>Registre des traitements</h2>
      <p>
        L&apos;article 30 du RGPD impose la tenue d&apos;un registre documentant
        chaque traitement : finalité, catégories de données, destinataires, durées de
        conservation et mesures de sécurité. Ce registre doit être tenu à jour et
        disponible pour la CNIL en cas de contrôle.
      </p>
    </>
  ),

  "comptabilite-immobiliere-fec-tva": (
    <>
      <p>
        La comptabilité immobilière obéit à des règles spécifiques qui combinent le
        plan comptable général, les obligations fiscales liées aux revenus fonciers
        et les contraintes de conformité FEC. Pour les foncières soumises à l&apos;IS
        ou les SCI à l&apos;IR, les enjeux diffèrent mais la rigueur reste identique.
      </p>

      <h2>Le Fichier des Écritures Comptables (FEC)</h2>
      <p>
        Depuis 2014, toute entreprise tenant une comptabilité informatisée doit
        pouvoir produire un FEC conforme à l&apos;article A.47 A-1 du Livre des
        Procédures Fiscales. Ce fichier contient l&apos;intégralité des écritures
        comptables de l&apos;exercice dans un format normalisé (18 colonnes
        obligatoires).
      </p>
      <p>
        Les colonnes obligatoires incluent : JournalCode, JournalLib, EcritureNum,
        EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef,
        PieceDate, EcritureLib, Debit, Credit, EcrtureLet, DateLet, ValidDate,
        Montantdevise, Idevise. Le séparateur est le pipe (|) ou la tabulation, et
        l&apos;encodage doit être UTF-8 ou ISO 8859-15.
      </p>

      <h2>TVA sur les loyers commerciaux</h2>
      <p>
        Les loyers d&apos;habitation sont exonérés de TVA. En revanche, les loyers
        commerciaux peuvent être soumis à la TVA sur option (article 260 du CGI). Cette
        option est irrévocable pendant une durée minimale de 9 ans (sauf cas de
        dispense) et permet de récupérer la TVA sur les travaux et les charges.
      </p>
      <p>
        L&apos;option pour la TVA s&apos;exerce lot par lot. Le logiciel de gestion
        doit donc permettre de paramétrer le régime TVA au niveau de chaque lot et de
        générer les factures avec ou sans TVA selon la configuration.
      </p>

      <h2>Plan comptable immobilier</h2>
      <p>
        Les comptes les plus utilisés en gestion immobilière sont : 706 (Produits des
        activités annexes — loyers), 614 (Charges locatives), 616 (Primes
        d&apos;assurance), 615 (Entretien et réparations), 661 (Charges
        d&apos;intérêts). La ventilation correcte entre charges récupérables et non
        récupérables est essentielle pour la régularisation annuelle des charges.
      </p>

      <h2>Régularisation des charges</h2>
      <p>
        Les provisions sur charges versées mensuellement par les locataires doivent
        être comparées aux charges réelles en fin d&apos;exercice. L&apos;écart donne
        lieu à un complément ou un remboursement. Ce processus requiert un suivi
        rigoureux des factures de charges par immeuble et par lot.
      </p>
    </>
  ),

  "digitalisation-gestion-locative-2026": (
    <>
      <p>
        La transformation numérique de la gestion locative n&apos;est plus une option.
        En 2026, les gestionnaires qui n&apos;ont pas automatisé leurs processus
        passent en moyenne 40% de leur temps sur des tâches administratives
        répétitives : saisie de quittances, suivi des encaissements, relances
        manuelles, classement de documents.
      </p>

      <h2>Automatisation de la facturation</h2>
      <p>
        La génération automatique des factures — loyers, provisions sur charges,
        régularisations — élimine les erreurs de saisie et garantit la régularité des
        appels. Les brouillons sont créés chaque mois par un processus planifié, puis
        validés par le gestionnaire avant envoi.
      </p>
      <p>
        L&apos;envoi automatisé par email avec PDF attaché et copie au propriétaire
        réduit le délai d&apos;encaissement et crée une trace numérique exploitable.
      </p>

      <h2>Rapprochement bancaire intelligent</h2>
      <p>
        La connexion bancaire via API (DSP2) permet de récupérer les mouvements en
        temps réel. L&apos;algorithme de rapprochement compare montants, dates et
        libellés pour proposer des correspondances automatiques entre les transactions
        et les factures. Le gestionnaire n&apos;intervient que pour valider ou corriger
        les exceptions.
      </p>

      <h2>Portail locataire</h2>
      <p>
        Un espace en ligne dédié permet au locataire de consulter ses factures, ses
        quittances et son solde en temps réel. Il peut y télécharger ses documents,
        signaler un incident de maintenance et mettre à jour ses coordonnées. Cette
        autonomie réduit le volume de sollicitations vers le gestionnaire.
      </p>

      <h2>Signature électronique</h2>
      <p>
        La signature électronique des baux, des états des lieux et des avenants
        accélère les processus et supprime les frais d&apos;impression et d&apos;envoi
        postal. La valeur juridique est identique à la signature manuscrite pour les
        signatures qualifiées (eIDAS).
      </p>

      <h2>Reporting en temps réel</h2>
      <p>
        Les tableaux de bord consolidés offrent une vision instantanée du patrimoine :
        taux d&apos;occupation, rendement, impayés, échéances de baux. L&apos;export
        PDF et Excel permet de partager ces données avec les investisseurs et les
        associés sans manipulation supplémentaire.
      </p>
    </>
  ),

  "indices-irl-ilc-ilat-revisions-loyer": (
    <>
      <p>
        Les révisions de loyer sont encadrées par la loi et s&apos;appuient sur des
        indices publiés trimestriellement par l&apos;INSEE. Comprendre le
        fonctionnement de ces indices et automatiser les calculs est essentiel pour
        rester conforme tout en optimisant les revenus locatifs.
      </p>

      <h2>L&apos;Indice de Référence des Loyers (IRL)</h2>
      <p>
        L&apos;IRL s&apos;applique aux baux d&apos;habitation. Publié chaque
        trimestre par l&apos;INSEE, il est calculé à partir de la moyenne sur 12 mois
        de l&apos;indice des prix à la consommation (hors tabac et loyers). La formule
        de révision est :
      </p>
      <p className="rounded-lg bg-slate-50 p-4 font-mono text-sm">
        Nouveau loyer = Loyer actuel × (IRL du trimestre de révision / IRL du même
        trimestre de l&apos;année précédente)
      </p>
      <p>
        La date de révision est fixée dans le bail, généralement à la date anniversaire.
        En l&apos;absence de clause, le loyer ne peut pas être révisé.
      </p>

      <h2>L&apos;Indice des Loyers Commerciaux (ILC)</h2>
      <p>
        L&apos;ILC concerne les baux commerciaux (activités commerciales et
        artisanales). Il est composé à 50% de l&apos;indice des prix à la
        consommation, 25% de l&apos;indice du chiffre d&apos;affaires du commerce de
        détail et 25% de l&apos;indice du coût de la construction.
      </p>

      <h2>L&apos;Indice des Loyers des Activités Tertiaires (ILAT)</h2>
      <p>
        L&apos;ILAT s&apos;applique aux baux de bureaux et d&apos;activités
        tertiaires. Sa composition est similaire à l&apos;ILC mais avec des
        pondérations adaptées au secteur tertiaire : 50% IPC, 25% indice du coût de
        la construction, 25% indice du PIB.
      </p>

      <h2>L&apos;Indice du Coût de la Construction (ICC)</h2>
      <p>
        Historiquement utilisé pour les baux commerciaux, l&apos;ICC est progressivement
        remplacé par l&apos;ILC et l&apos;ILAT. Il reste applicable pour les baux
        signés avant 2008 qui y font explicitement référence.
      </p>

      <h2>Automatiser les révisions</h2>
      <p>
        Un logiciel de gestion immobilière doit récupérer automatiquement les derniers
        indices publiés par l&apos;INSEE, calculer les nouveaux loyers aux dates
        anniversaires et générer les avenants correspondants. Les gestionnaires
        n&apos;interviennent que pour valider les propositions de révision.
      </p>
      <p>
        L&apos;automatisation garantit la conformité des calculs et évite les oublis
        de révision, qui représentent un manque à gagner cumulatif sur la durée du
        bail.
      </p>
    </>
  ),
};

// ── Page component ──────────────────────────────────────────────────

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const content = ARTICLE_CONTENT[slug];
  if (!content) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    author: { "@type": "Organization", name: APP_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: APP_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-mygestia.svg` },
    },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-gray-900">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/blog"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              Blog
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Se connecter
            </Link>
          </nav>
        </div>
      </header>

      {/* Article */}
      <article className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au blog
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${getCategoryColor(article.category)}`}
          >
            {article.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateFr(article.date)}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            {article.readTime}
          </span>
        </div>

        <h1 className="mb-8 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {article.title}
        </h1>

        <div className="article-content space-y-5 text-base leading-relaxed text-gray-700 [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-gray-900 [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900 [&_li]:ml-6 [&_li]:list-disc [&_li]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-gray-900 [&_ul]:space-y-2">
          {content}
        </div>
      </article>

      {/* CTA */}
      <section className="border-t border-gray-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Découvrir {APP_NAME}
          </h2>
          <p className="mt-4 text-gray-600">
            Centralisez la gestion de votre patrimoine immobilier : baux,
            facturation, comptabilité FEC, rapprochement bancaire et reporting.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Essayer gratuitement
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} {APP_NAME}. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
