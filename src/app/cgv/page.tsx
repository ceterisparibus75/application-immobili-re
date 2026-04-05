import { Building2 } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

export const metadata = {
  title: `Conditions Generales de Vente | ${APP_NAME}`,
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/cgu" className="text-muted-foreground hover:text-foreground">CGU</Link>
            <Link href="/mentions-legales" className="text-muted-foreground hover:text-foreground">Mentions legales</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-2">Conditions Generales de Vente</h1>
        <p className="text-muted-foreground mb-8">Derniere mise a jour : 1er avril 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Objet</h2>
            <p className="text-muted-foreground">
              Les presentes Conditions Generales de Vente (CGV) regissent les conditions de souscription et d&apos;utilisation des abonnements au service {APP_NAME}, plateforme SaaS de gestion immobiliere editee par la societe dont les coordonnees figurent dans les <Link href="/mentions-legales" className="underline">mentions legales</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Description des offres</h2>
            <p className="text-muted-foreground mb-3">Le Service est propose sous forme d&apos;abonnements avec trois niveaux de fonctionnalites :</p>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Starter</h3>
                <p className="text-muted-foreground">Gestion de patrimoine, baux et locataires, facturation et tableau de bord. Jusqu&apos;a 10 lots, 1 societe, 2 utilisateurs.</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Pro</h3>
                <p className="text-muted-foreground">Toutes les fonctionnalites Starter, plus la comptabilite complete, connexion bancaire, relances automatiques, export FEC et portail locataire. Jusqu&apos;a 50 lots, 3 societes, 5 utilisateurs.</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Enterprise</h3>
                <p className="text-muted-foreground">Toutes les fonctionnalites Pro, plus lots et societes illimites, signature electronique, import IA de documents, support prioritaire et acces API.</p>
              </div>
            </div>
            <p className="text-muted-foreground mt-3">
              Les tarifs en vigueur sont affiches sur la <Link href="/pricing" className="underline">page de tarification</Link> et peuvent etre modifies. Toute modification tarifaire sera notifiee 30 jours avant son application aux abonnes existants.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Commande et souscription</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>La souscription s&apos;effectue en ligne via le Service. L&apos;Utilisateur choisit son offre, renseigne ses informations de facturation et procede au paiement par carte bancaire.</p>
              <p>La souscription est effective des la confirmation du paiement. Un email de confirmation est envoye a l&apos;adresse de facturation.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Tarifs et modalites de paiement</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>Les prix sont indiques en euros hors taxes (HT). La TVA applicable est ajoutee au moment de la facturation selon la reglementation en vigueur.</p>
              <p>Le paiement s&apos;effectue par carte bancaire via la plateforme securisee Stripe. Les paiements sont preleves automatiquement a chaque echeance (mensuelle ou annuelle selon le choix de l&apos;Utilisateur).</p>
              <p>En cas de defaut de paiement, l&apos;acces au Service pourra etre suspendu apres une relance restee sans effet pendant 15 jours. Les donnees sont conservees pendant 90 jours apres suspension, apres quoi elles pourront etre supprimees.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Periode d&apos;essai gratuite</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>Chaque nouvelle souscription beneficie d&apos;une periode d&apos;essai gratuite de 14 jours, donnant acces a l&apos;ensemble des fonctionnalites de l&apos;offre choisie.</p>
              <p>A l&apos;issue de la periode d&apos;essai, l&apos;abonnement est automatiquement active et le premier paiement est preleve, sauf si l&apos;Utilisateur a annule son abonnement avant la fin de la periode d&apos;essai.</p>
              <p>Aucun moyen de paiement n&apos;est debite pendant la periode d&apos;essai.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Droit de retractation</h2>
            <p className="text-muted-foreground">
              Conformement a l&apos;article L221-28 du Code de la consommation, le droit de retractation ne s&apos;applique pas aux contrats de fourniture de contenu numerique non fourni sur support materiel dont l&apos;execution a commence avec l&apos;accord du consommateur. Toutefois, l&apos;Editeur accorde un delai de retractation de 14 jours a compter de la souscription (hors periode d&apos;essai). Le remboursement sera effectue dans les 14 jours suivant la demande.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Duree et renouvellement</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>Les abonnements sont souscrits pour une duree mensuelle ou annuelle au choix de l&apos;Utilisateur. Ils sont renouveles automatiquement a chaque echeance, sauf resiliation par l&apos;Utilisateur.</p>
              <p>L&apos;abonnement annuel beneficie d&apos;une remise par rapport a l&apos;abonnement mensuel. Le tarif est indique sur la page de tarification.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Resiliation</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>L&apos;Utilisateur peut resilier son abonnement a tout moment depuis son espace de gestion de facturation. La resiliation prend effet a la fin de la periode en cours (mensuelle ou annuelle).</p>
              <p>Aucun remboursement au prorata ne sera accorde pour la periode restante, sauf dans le cadre du droit de retractation prevu a l&apos;article 6.</p>
              <p>Apres resiliation, l&apos;Utilisateur conserve un acces en lecture seule a ses donnees pendant 30 jours, durant lesquels il peut exporter ses donnees. Passe ce delai, les donnees pourront etre supprimees.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Changement d&apos;offre</h2>
            <div className="space-y-3 text-muted-foreground">
              <p><strong>Upgrade :</strong> Le passage a une offre superieure prend effet immediatement. Le montant restant de la periode en cours est credite au prorata sur la nouvelle offre.</p>
              <p><strong>Downgrade :</strong> Le passage a une offre inferieure prend effet a la fin de la periode en cours. L&apos;Utilisateur doit s&apos;assurer que son utilisation est compatible avec les limites de la nouvelle offre.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Garanties et limitations</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>L&apos;Editeur s&apos;engage a fournir le Service avec un taux de disponibilite cible de 99,5% (hors maintenance planifiee). Les maintenances planifiees sont notifiees 48 heures a l&apos;avance.</p>
              <p>Le Service est fourni &quot;en l&apos;etat&quot;. L&apos;Editeur ne garantit pas que le Service repondra a l&apos;ensemble des besoins specifiques de l&apos;Utilisateur.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Force majeure</h2>
            <p className="text-muted-foreground">
              L&apos;Editeur ne saurait etre tenu responsable de l&apos;inexecution de ses obligations en cas de force majeure au sens de l&apos;article 1218 du Code civil, incluant notamment les catastrophes naturelles, pannes generalisees des reseaux de telecommunication, cyberattaques d&apos;ampleur exceptionnelle et decisions gouvernementales empechant l&apos;execution du Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Loi applicable</h2>
            <p className="text-muted-foreground">
              Les presentes CGV sont soumises au droit francais. Tout litige sera soumis a la competence exclusive des tribunaux de Paris, sous reserve des regles imperatives de competence applicables aux consommateurs.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t text-xs text-muted-foreground flex gap-4">
          <Link href="/cgu" className="hover:underline">Conditions Generales d&apos;Utilisation</Link>
          <Link href="/dpa" className="hover:underline">Accord de traitement des donnees</Link>
          <Link href="/politique-confidentialite" className="hover:underline">Politique de confidentialite</Link>
          <Link href="/mentions-legales" className="hover:underline">Mentions legales</Link>
        </div>
      </main>
    </div>
  );
}
