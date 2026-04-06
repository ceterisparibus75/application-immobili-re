import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock, Calendar } from "lucide-react";
import { articles, getCategoryColor } from "./_data/articles";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata: Metadata = {
  title: "Blog — Gestion immobilière, réglementation et fiscalité foncière",
  description:
    "Articles et guides pratiques sur la gestion immobilière professionnelle : RGPD, comptabilité FEC, révisions de loyer, digitalisation de la gestion locative.",
  openGraph: {
    title: `Blog ${APP_NAME} — Ressources pour gestionnaires immobiliers`,
    description:
      "Guides, analyses et bonnes pratiques pour les professionnels de la gestion immobilière et les foncières privées.",
    type: "website",
  },
};

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-gray-900">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              Accueil
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              Tarifs
            </Link>
            <Link
              href="/contact"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              Contact
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

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Ressources pour la gestion immobilière professionnelle
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Guides pratiques, analyses réglementaires et retours d&apos;expérience
            pour structurer et optimiser la gestion de votre patrimoine
            immobilier.
          </p>
        </div>
      </section>

      {/* Articles grid */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-200 hover:shadow-md"
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getCategoryColor(article.category)}`}
                >
                  {article.category}
                </span>
              </div>

              <h2 className="mb-3 text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-700">
                {article.title}
              </h2>

              <p className="mb-6 flex-1 text-sm leading-relaxed text-gray-600">
                {article.description}
              </p>

              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateFr(article.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {article.readTime}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Passez de la lecture a l&apos;action
          </h2>
          <p className="mt-4 text-gray-600">
            {APP_NAME} centralise la gestion de votre patrimoine immobilier :
            baux, facturation, comptabilité FEC, rapprochement bancaire et
            reporting consolidé.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Essayer gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Demander une démonstration
            </Link>
          </div>
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
