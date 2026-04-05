import { Building2 } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Accord de Traitement des Donnees | ${APP_NAME}`,
};

export default function DPAPage() {
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
            <Link href="/politique-confidentialite" className="text-muted-foreground hover:text-foreground">Confidentialite</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-2">Accord de Traitement des Donnees (DPA)</h1>
        <p className="text-muted-foreground mb-2">Data Processing Agreement — Article 28 du RGPD</p>
        <p className="text-muted-foreground mb-8">Derniere mise a jour : 1er avril 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Objet</h2>
            <p className="text-muted-foreground">
              Le present accord definit les conditions dans lesquelles l&apos;Editeur du service {APP_NAME} (ci-apres &quot;le Sous-traitant&quot;) traite des donnees a caractere personnel pour le compte du Client (ci-apres &quot;le Responsable de traitement&quot;), conformement a l&apos;article 28 du Reglement General sur la Protection des Donnees (RGPD - Reglement UE 2016/679).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Roles et responsabilites</h2>
            <div className="space-y-3 text-muted-foreground">
              <p><strong>Responsable de traitement :</strong> le Client, utilisateur du service {APP_NAME}, qui determine les finalites et les moyens du traitement des donnees de ses locataires, copropietaires et partenaires commerciaux.</p>
              <p><strong>Sous-traitant :</strong> l&apos;Editeur du service {APP_NAME}, qui traite les donnees personnelles uniquement pour le compte et sur instruction du Responsable de traitement, dans le cadre de la fourniture du Service.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Finalites du traitement</h2>
            <p className="text-muted-foreground mb-3">Les donnees personnelles sont traitees exclusivement pour les finalites suivantes :</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Gestion du patrimoine immobilier (immeubles, lots, diagnostics)</li>
              <li>Gestion des baux et de la relation locataire</li>
              <li>Facturation, quittancement et suivi des paiements</li>
              <li>Comptabilite et reporting financier</li>
              <li>Connexion bancaire et rapprochement des transactions</li>
              <li>Envoi de communications (relances, notifications, documents)</li>
              <li>Generation de documents (factures, quittances, lettres)</li>
              <li>Conformite reglementaire (diagnostics, indices, charges)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Categories de donnees traitees</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-muted-foreground border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">Categorie</th>
                    <th className="text-left py-2 font-semibold">Donnees concernees</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 pr-4">Locataires</td>
                    <td className="py-2">Nom, prenom, adresse, email, telephone, date de naissance, lieu de naissance, nationalite, profession, situation familiale</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Baux</td>
                    <td className="py-2">Dates de debut/fin, montant du loyer, depot de garantie, conditions particulieres</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Paiements</td>
                    <td className="py-2">Montants, dates, references bancaires, historique de paiement</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Documents</td>
                    <td className="py-2">Pieces d&apos;identite, justificatifs, contrats, etats des lieux</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Donnees bancaires</td>
                    <td className="py-2">IBAN, BIC (chiffres AES-256-GCM)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Utilisateurs</td>
                    <td className="py-2">Nom, email, mot de passe (hache bcrypt), adresse IP de connexion</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Durees de conservation</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-muted-foreground border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">Categorie</th>
                    <th className="text-left py-2 font-semibold">Duree</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 pr-4">Locataire avec bail actif</td>
                    <td className="py-2">Duree du bail + conservation legale</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Locataire archive</td>
                    <td className="py-2">5 ans apres la fin du dernier bail</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Documents d&apos;identite</td>
                    <td className="py-2">3 ans apres la fin de la relation contractuelle</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Donnees bancaires</td>
                    <td className="py-2">10 ans (obligation legale comptable)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Journaux d&apos;audit</td>
                    <td className="py-2">1 an</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Consentements</td>
                    <td className="py-2">3 ans apres revocation</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Mesures de securite</h2>
            <p className="text-muted-foreground mb-3">Le Sous-traitant met en oeuvre les mesures techniques et organisationnelles suivantes :</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Chiffrement :</strong> AES-256-GCM pour les donnees bancaires sensibles (IBAN, BIC), bcrypt pour les mots de passe, TLS 1.3 pour les communications.</li>
              <li><strong>Controle d&apos;acces :</strong> authentification par identifiants avec option 2FA (TOTP), RBAC a 5 niveaux (Super Admin, Admin Societe, Gestionnaire, Comptable, Lecture seule).</li>
              <li><strong>Securite applicative :</strong> verrouillage de compte apres 5 tentatives echouees, rate limiting sur les endpoints sensibles, Content Security Policy (CSP) avec nonce, HSTS, X-Frame-Options DENY.</li>
              <li><strong>Journalisation :</strong> audit log de toutes les operations sensibles (creation, modification, suppression, acces aux donnees), conserve 1 an.</li>
              <li><strong>Isolation :</strong> architecture multi-tenant avec scoping strict par societe (societyId) sur toutes les requetes base de donnees.</li>
              <li><strong>Sauvegardes :</strong> sauvegardes automatiques quotidiennes de la base de donnees via l&apos;hebergeur (Supabase/PostgreSQL).</li>
              <li><strong>Verification des fichiers :</strong> validation des types MIME par magic bytes avant tout upload.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Sous-traitants ulterieurs</h2>
            <p className="text-muted-foreground mb-3">Le Sous-traitant fait appel aux sous-traitants ulterieurs suivants, autorises par le Responsable de traitement :</p>
            <div className="overflow-x-auto">
              <table className="w-full text-muted-foreground border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">Sous-traitant</th>
                    <th className="text-left py-2 pr-4 font-semibold">Finalite</th>
                    <th className="text-left py-2 font-semibold">Localisation</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 pr-4">Supabase (PostgreSQL)</td>
                    <td className="py-2 pr-4">Hebergement base de donnees et stockage fichiers</td>
                    <td className="py-2">UE (Frankfurt)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Vercel</td>
                    <td className="py-2 pr-4">Hebergement de l&apos;application</td>
                    <td className="py-2">Global (CDN) / UE</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Stripe</td>
                    <td className="py-2 pr-4">Traitement des paiements (abonnements)</td>
                    <td className="py-2">UE / US (clauses contractuelles types)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Resend</td>
                    <td className="py-2 pr-4">Envoi d&apos;emails transactionnels</td>
                    <td className="py-2">US (clauses contractuelles types)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Sentry</td>
                    <td className="py-2 pr-4">Monitoring et suivi d&apos;erreurs</td>
                    <td className="py-2">US (clauses contractuelles types)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Upstash</td>
                    <td className="py-2 pr-4">Cache et rate limiting (Redis)</td>
                    <td className="py-2">UE (Frankfurt)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-3">
              Le Sous-traitant informera le Responsable de traitement de tout changement dans la liste des sous-traitants ulterieurs au moins 30 jours avant la mise en oeuvre, laissant au Responsable de traitement la possibilite de s&apos;y opposer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Transferts internationaux</h2>
            <p className="text-muted-foreground">
              Les donnees sont principalement hebergees dans l&apos;Union Europeenne. Lorsque des transferts vers des pays tiers sont necessaires (sous-traitants localises aux Etats-Unis), ils sont encadres par des clauses contractuelles types (CCT) approuvees par la Commission Europeenne, conformement a l&apos;article 46 du RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Droits des personnes concernees</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>Le Sous-traitant assiste le Responsable de traitement dans l&apos;exercice des droits des personnes concernees :</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Droit d&apos;acces :</strong> export des donnees depuis l&apos;interface du Service (module RGPD).</li>
                <li><strong>Droit de rectification :</strong> modification des donnees via l&apos;interface de gestion.</li>
                <li><strong>Droit a l&apos;effacement :</strong> anonymisation des donnees via le module RGPD, dans le respect des obligations legales de conservation.</li>
                <li><strong>Droit a la portabilite :</strong> export des donnees au format structure (CSV, JSON).</li>
                <li><strong>Droit d&apos;opposition et limitation :</strong> desactivation du traitement via le module de consentement.</li>
              </ul>
              <p>Le Responsable de traitement peut gerer ces demandes via le module RGPD integre au Service (menu Administration &gt; RGPD).</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Notification des violations</h2>
            <p className="text-muted-foreground">
              En cas de violation de donnees a caractere personnel, le Sous-traitant notifiera le Responsable de traitement dans un delai maximum de 48 heures apres en avoir pris connaissance, en fournissant toutes les informations necessaires pour permettre au Responsable de traitement de notifier l&apos;autorite de controle (CNIL) dans le delai legal de 72 heures.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Audit</h2>
            <p className="text-muted-foreground">
              Le Responsable de traitement peut realiser ou faire realiser des audits de conformite, sous reserve d&apos;un preavis de 30 jours et d&apos;un accord de confidentialite. Le Sous-traitant met a disposition les journaux d&apos;audit et les informations necessaires pour demontrer sa conformite au RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Sort des donnees en fin de contrat</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>A la fin du contrat, le Sous-traitant :</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Met a disposition un export complet des donnees pendant 30 jours.</li>
                <li>Supprime l&apos;ensemble des donnees personnelles a l&apos;issue de ce delai, sauf obligation legale de conservation.</li>
                <li>Fournit un certificat de suppression sur demande.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Duree</h2>
            <p className="text-muted-foreground">
              Le present accord est conclu pour la duree de la relation contractuelle entre le Responsable de traitement et le Sous-traitant. Il prend fin automatiquement lors de la resiliation de l&apos;abonnement au Service, sous reserve des obligations de conservation legales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">14. Loi applicable</h2>
            <p className="text-muted-foreground">
              Le present accord est regi par le droit francais et le RGPD. En cas de litige relatif a l&apos;interpretation ou l&apos;execution du present accord, les tribunaux competents de Paris seront seuls competents.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t text-xs text-muted-foreground flex gap-4">
          <Link href="/cgu" className="hover:underline">Conditions Generales d&apos;Utilisation</Link>
          <Link href="/cgv" className="hover:underline">Conditions Generales de Vente</Link>
          <Link href="/politique-confidentialite" className="hover:underline">Politique de confidentialite</Link>
          <Link href="/mentions-legales" className="hover:underline">Mentions legales</Link>
        </div>
      </main>
    </div>
  );
}
