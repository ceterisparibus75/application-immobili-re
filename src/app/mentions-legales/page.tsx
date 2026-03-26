import { Building2 } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Mentions légales | GestImmo",
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">GestImmo</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/locaux" className="text-muted-foreground hover:text-foreground">Locaux disponibles</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Éditeur du site</h2>
            <p className="text-muted-foreground">Le présent site est édité par :</p>
            <div className="mt-3 space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Raison sociale :</strong> MTG Groupe</p>
              <p><strong className="text-foreground">Forme juridique :</strong> SAS</p>
              <p><strong className="text-foreground">Siège social :</strong> France</p>
              <p><strong className="text-foreground">Email :</strong> contact@mtggroupe.org</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Directeur de publication</h2>
            <p className="text-muted-foreground">Le directeur de publication est le représentant légal de MTG Groupe.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Hébergement</h2>
            <div className="space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Hébergeur :</strong> Vercel Inc.</p>
              <p><strong className="text-foreground">Adresse :</strong> 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis</p>
              <p><strong className="text-foreground">Site web :</strong> vercel.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Propriété intellectuelle</h2>
            <p className="text-muted-foreground">
              L&apos;ensemble des contenus présents sur ce site (textes, images, graphismes, logo, icônes) est la propriété exclusive
              de MTG Groupe et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
              Toute reproduction, distribution ou utilisation sans autorisation préalable est strictement interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Responsabilité</h2>
            <p className="text-muted-foreground">
              MTG Groupe s&apos;efforce de fournir des informations exactes et à jour. Toutefois, nous ne garantissons pas l&apos;exactitude,
              la complétude ou la pertinence des informations diffusées sur ce site. MTG Groupe ne saurait être tenu responsable
              des dommages directs ou indirects résultant de l&apos;utilisation de ce site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Données personnelles</h2>
            <p className="text-muted-foreground">
              Les informations relatives à la collecte et au traitement de vos données personnelles sont détaillées dans notre{" "}
              <Link href="/politique-confidentialite" className="text-primary underline">Politique de confidentialité</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Contact</h2>
            <p className="text-muted-foreground">
              Pour toute question relative aux mentions légales, vous pouvez nous contacter à :
              <strong className="text-foreground"> contact@mtggroupe.org</strong>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MTG Groupe. Tous droits réservés.</p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="hover:text-foreground">Mentions légales</Link>
            <Link href="/politique-confidentialite" className="hover:text-foreground">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
