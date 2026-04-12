import { Building2 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Politique de confidentialite | MyGestia" };

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"><Link href="/" className="flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /><span className="font-bold text-lg">MyGestia</span></Link><nav className="flex items-center gap-6 text-sm"><Link href="/locaux" className="text-muted-foreground hover:text-foreground">Locaux disponibles</Link><Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></nav></div></header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-2">Politique de confidentialite</h1>
        <p className="text-sm text-muted-foreground mb-8">Derniere mise a jour : mars 2025</p>
        <div className="space-y-8 text-sm leading-relaxed">
          <section><h2 className="text-xl font-semibold mb-4">1. Responsable du traitement</h2><p className="text-muted-foreground">MTG HOLDING (41 Rue de Paris, 97400 Saint-Denis — RCS 913 038 717), joignable à <strong className="text-foreground">contact@mygestia.immo</strong>, est responsable du traitement de vos données personnelles.</p></section>
          <section><h2 className="text-xl font-semibold mb-4">2. Bases legales</h2><ul className="list-disc pl-6 space-y-2 text-muted-foreground"><li><strong className="text-foreground">Execution du contrat</strong> : gestion des baux, facturation</li><li><strong className="text-foreground">Obligation legale</strong> : conservation comptable 10 ans</li><li><strong className="text-foreground">Interet legitime</strong> : securite, logs audit</li></ul></section>
          <section><h2 className="text-xl font-semibold mb-4">3. Durees de conservation</h2><ul className="list-disc pl-6 space-y-2 text-muted-foreground"><li>Locataire actif : duree de la relation</li><li>Locataire archive : 5 ans apres fin de bail</li><li>Documents identite : 3 ans apres fin de relation</li><li>Donnees bancaires : 10 ans (obligation legale)</li><li>Logs audit : 1 an</li></ul></section>
          <section><h2 className="text-xl font-semibold mb-4">4. Vos droits (RGPD)</h2><ul className="list-disc pl-6 space-y-2 text-muted-foreground"><li><strong className="text-foreground">Acces</strong> : obtenir une copie de vos donnees</li><li><strong className="text-foreground">Rectification</strong> : corriger des donnees inexactes</li><li><strong className="text-foreground">Effacement</strong> : demander la suppression</li><li><strong className="text-foreground">Portabilite</strong> : recevoir vos donnees</li><li><strong className="text-foreground">Opposition</strong> : vous opposer a certains traitements</li></ul><p className="text-muted-foreground mt-3">Exercez vos droits a <strong className="text-foreground">contact@mygestia.immo</strong>. Reclamations possibles aupres de la CNIL (cnil.fr).</p></section>
          <section><h2 className="text-xl font-semibold mb-4">5. Securite</h2><p className="text-muted-foreground">Chiffrement AES-256-GCM, bcrypt + JWT, 2FA disponible, logs audit, RBAC.</p></section>
          <section><h2 className="text-xl font-semibold mb-4">6. Cookies</h2><p className="text-muted-foreground">Cookies fonctionnels strictement necessaires : next-auth.session-token (session 24h), active-society-id (societe active). Aucun cookie publicitaire ou tracking tiers.</p></section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Traitements lies a l&apos;intelligence artificielle</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>
                Le Service propose des fonctionnalites optionnelles d&apos;intelligence artificielle, reservees au plan ENTERPRISE. Ces fonctionnalites incluent l&apos;analyse automatique de documents, la generation assistee de courriers, la prediction de paiements et l&apos;evaluation patrimoniale.
              </p>
              <p><strong className="text-foreground">Sous-traitant IA :</strong> ces traitements sont realises via l&apos;API Claude d&apos;Anthropic, PBC (San Francisco, CA, Etats-Unis). Les transferts vers les Etats-Unis sont encadres par des clauses contractuelles types (CCT) conformement a l&apos;article 46 du RGPD.</p>
              <p><strong className="text-foreground">Donnees transmises :</strong> seules les donnees strictement necessaires au traitement demande sont envoyees a l&apos;API Anthropic (principe de minimisation des donnees). Selon la fonctionnalite, cela peut inclure : le contenu textuel des documents a analyser, les informations de bail et de paiement pour les predictions, les donnees patrimoniales pour les evaluations.</p>
              <p><strong className="text-foreground">Pas d&apos;entrainement sur vos donnees :</strong> conformement aux conditions d&apos;utilisation commerciales d&apos;Anthropic, les donnees transmises via l&apos;API ne sont <strong>pas utilisees pour entrainer les modeles d&apos;IA</strong>.</p>
              <p><strong className="text-foreground">Conservation :</strong> les conversations et requetes IA ne sont pas conservees cote serveur apres le traitement. Aucun historique de conversation IA n&apos;est persiste dans notre base de donnees. Les resultats de l&apos;analyse (resume, tags, categorie) sont stockes en base de donnees, mais pas les echanges avec l&apos;API IA.</p>
              <p><strong className="text-foreground">Caractere facultatif :</strong> l&apos;utilisation des fonctionnalites IA est entierement facultative. Elles ne sont accessibles que sur le plan ENTERPRISE et peuvent etre desactivees a tout moment sans impact sur les autres fonctionnalites du Service.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Droits specifiques lies a l&apos;IA (RGPD)</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>Conformement au RGPD et au Reglement europeen sur l&apos;intelligence artificielle (AI Act), vous disposez des droits suivants concernant les traitements IA :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-foreground">Droit d&apos;opposition</strong> : vous pouvez refuser que vos donnees soient traitees par les fonctionnalites IA, sans que cela n&apos;affecte votre acces aux autres fonctionnalites du Service.</li>
                <li><strong className="text-foreground">Droit a l&apos;information</strong> : vous etes informe lorsqu&apos;un traitement IA est utilise. Les resultats generes par l&apos;IA sont clairement identifies comme tels dans l&apos;interface.</li>
                <li><strong className="text-foreground">Intervention humaine</strong> : les resultats de l&apos;IA (analyses, predictions, evaluations) sont fournis a titre indicatif et ne se substituent pas a la decision humaine. L&apos;Utilisateur conserve le controle final sur toute action.</li>
                <li><strong className="text-foreground">Minimisation des donnees</strong> : seules les donnees strictement necessaires sont transmises au fournisseur IA pour chaque traitement.</li>
              </ul>
              <p>Pour exercer ces droits, contactez-nous a <strong className="text-foreground">contact@mygestia.immo</strong>.</p>
            </div>
          </section>
        </div>
      </main>
      <footer className="border-t py-8 mt-16"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground"><p>&copy; {new Date().getFullYear()} MyGestia.</p><div className="flex gap-4"><Link href="/mentions-legales" className="hover:text-foreground">Mentions legales</Link><Link href="/politique-confidentialite" className="hover:text-foreground">Confidentialite</Link></div></div></footer>
    </div>
  );
}
