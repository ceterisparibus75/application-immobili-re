import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contactez MyGestia — Démonstration et questions",
  description:
    "Parlons de votre projet immobilier. Démonstration, devis, questions sur nos plans Essentiel, Professionnel et Institutionnel. Réponse sous 24h ouvrées.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
