import { Building2 } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

export const metadata = {
  title: `Conditions Generales d'Utilisation | ${APP_NAME}`,
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/cgv" className="text-muted-foreground hover:text-foreground">CGV</Link>
            <Link href="/mentions-legales" className="text-muted-foreground hover:text-foreground">Mentions legales</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-2">Conditions Generales d&apos;Utilisation</h1>
        <p className="text-muted-foreground mb-8">Derniere mise a jour : 1er avril 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Definitions</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Service</strong> : la plateforme SaaS {APP_NAME} de gestion immobiliere, accessible via navigateur web.</li>
              <li><strong>Editeur</strong> : la societe editrice du Service, dont les coordonnees figurent dans les <Link href="/mentions-legales" className="underline">mentions legales</Link>.</li>
              <li><strong>Utilisateur</strong> : toute personne physique disposant d&apos;un compte sur le Service.</li>
              <li><strong>Societe</strong> : l&apos;entite juridique (SCI, SARL, etc.) creee par l&apos;Utilisateur dans le Service pour gerer son patrimoine immobilier.</li>
              <li><strong>Locataire</strong> : la personne physique ou morale dont les donnees sont enregistrees dans le Service dans le cadre d&apos;un bail.</li>
              <li><strong>Contenu</strong> : l&apos;ensemble des donnees, documents, fichiers et informations saisis ou importes par l&apos;Utilisateur.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Objet du Service</h2>
            <p className="text-muted-foreground">
              {APP_NAME} est une solution SaaS destinee aux gestionnaires de biens immobiliers. Le Service permet notamment la gestion du patrimoine (immeubles, lots), des baux et locataires, de la facturation et des paiements, de la comptabilite, de la connexion bancaire, de la generation de documents (quittances, factures, relances) et du suivi reglementaire (diagnostics, charges, indices).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Conditions d&apos;acces et d&apos;inscription</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>L&apos;acces au Service necessite la creation d&apos;un compte utilisateur avec une adresse email valide et un mot de passe securise. L&apos;Utilisateur garantit l&apos;exactitude des informations fournies.</p>
              <p>L&apos;Utilisateur est responsable de la confidentialite de ses identifiants de connexion. Toute utilisation du Service realisee avec ses identifiants est reputee effectuee par l&apos;Utilisateur lui-meme.</p>
              <p>L&apos;Editeur recommande l&apos;activation de l&apos;authentification a deux facteurs (2FA) pour renforcer la securite du compte.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Obligations de l&apos;Utilisateur</h2>
            <p className="text-muted-foreground mb-3">L&apos;Utilisateur s&apos;engage a :</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Utiliser le Service conformement a sa destination et aux lois en vigueur.</li>
              <li>Ne pas tenter d&apos;acceder a des donnees ne lui appartenant pas.</li>
              <li>Ne pas perturber le fonctionnement du Service par des actions automatisees non autorisees.</li>
              <li>Respecter la reglementation RGPD applicable aux donnees personnelles de ses locataires.</li>
              <li>Maintenir a jour les informations relatives a sa Societe et a ses baux.</li>
              <li>Ne pas revendre ou sous-licencier l&apos;acces au Service sans accord ecrit de l&apos;Editeur.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Propriete intellectuelle</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>Le Service, son interface, son code source, ses algorithmes, sa documentation et ses bases de donnees sont la propriete exclusive de l&apos;Editeur et sont proteges par les lois relatives a la propriete intellectuelle.</p>
              <p>L&apos;Utilisateur conserve la propriete integrale de son Contenu. L&apos;Editeur ne revendique aucun droit sur les donnees saisies par l&apos;Utilisateur.</p>
              <p>L&apos;Utilisateur accorde a l&apos;Editeur une licence limitee d&apos;utilisation de son Contenu, exclusivement pour le fonctionnement technique du Service (stockage, affichage, sauvegarde, traitement).</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Responsabilite et limitations</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>L&apos;Editeur s&apos;engage a fournir le Service avec diligence, selon une obligation de moyens. Le Service est fourni &quot;en l&apos;etat&quot;.</p>
              <p>L&apos;Editeur ne saurait etre tenu responsable :</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Des dommages indirects, y compris la perte de chiffre d&apos;affaires, de donnees ou d&apos;opportunites.</li>
                <li>Des interruptions temporaires du Service pour maintenance ou mise a jour.</li>
                <li>De l&apos;inexactitude des donnees saisies par l&apos;Utilisateur.</li>
                <li>Des dysfonctionnements lies aux services tiers (hebergement, paiement, email).</li>
              </ul>
              <p>En tout etat de cause, la responsabilite de l&apos;Editeur est limitee au montant des sommes effectivement versees par l&apos;Utilisateur au cours des 12 derniers mois.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Donnees personnelles</h2>
            <p className="text-muted-foreground">
              Le traitement des donnees personnelles est regi par notre <Link href="/politique-confidentialite" className="underline">Politique de confidentialite</Link> et notre <Link href="/dpa" className="underline">Accord de traitement des donnees (DPA)</Link>. L&apos;Utilisateur, en tant que responsable de traitement des donnees de ses locataires, est tenu de respecter le RGPD dans l&apos;utilisation du Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Duree et resiliation</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>Les presentes CGU s&apos;appliquent pendant toute la duree d&apos;utilisation du Service par l&apos;Utilisateur.</p>
              <p>L&apos;Utilisateur peut resilier son compte a tout moment depuis les parametres de son espace. La resiliation entraine la suppression du compte apres un delai de 30 jours, pendant lequel l&apos;Utilisateur peut exporter ses donnees.</p>
              <p>L&apos;Editeur se reserve le droit de suspendre ou supprimer un compte en cas de violation des presentes CGU, apres mise en demeure restee sans effet pendant 15 jours.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Modifications des CGU</h2>
            <p className="text-muted-foreground">
              L&apos;Editeur se reserve le droit de modifier les presentes CGU. Les Utilisateurs seront informes par email ou notification dans le Service au moins 30 jours avant l&apos;entree en vigueur des modifications. La poursuite de l&apos;utilisation du Service apres cette date vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Loi applicable et juridiction</h2>
            <p className="text-muted-foreground">
              Les presentes CGU sont regies par le droit francais. En cas de litige, les parties s&apos;engagent a rechercher une solution amiable. A defaut, les tribunaux competents de Paris seront seuls competents.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t text-xs text-muted-foreground flex gap-4">
          <Link href="/cgv" className="hover:underline">Conditions Generales de Vente</Link>
          <Link href="/dpa" className="hover:underline">Accord de traitement des donnees</Link>
          <Link href="/politique-confidentialite" className="hover:underline">Politique de confidentialite</Link>
          <Link href="/mentions-legales" className="hover:underline">Mentions legales</Link>
        </div>
      </main>
    </div>
  );
}
